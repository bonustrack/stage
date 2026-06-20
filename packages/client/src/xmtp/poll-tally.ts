/** @file Pure poll-vote tally helpers + the vote-key wire codec split out of poll.ts for the line cap; votes are schema:'custom' reaction events whose `reference` is the poll message id and `content` is the vote key ("q:o", or a bare option index for question 0 / legacy). */

/** Parse a vote `content` string into its (questionIndex, optionIndex). The wire form is `"q:o"`; a BARE integer (legacy single-question votes) is question 0. Returns null when the string is not a valid vote key. */
export function parseVoteKey(content: string): { q: number; o: number } | null {
  const m = /^(?:(\d+):)?(\d+)$/.exec(content);
  if (!m) return null;
  const q = m[1] === undefined ? 0 : Number(m[1]);
  const o = Number(m[2]);
  if (!Number.isInteger(q) || !Number.isInteger(o)) return null;
  return { q, o };
}

/** Build the vote `content` string for a (questionIndex, optionIndex). Question 0 emits a BARE option index so legacy single-question clients (and the existing tally) keep decoding it; other questions use the `"q:o"` form. */
export function voteKey(questionIndex: number, optionIndex: number): string {
  return questionIndex === 0 ? String(optionIndex) : `${questionIndex}:${optionIndex}`;
}

/** UTF-8-safe base64 encode working in both RN (Hermes btoa) and Node (Buffer fallback) so a free-text answer containing `:` survives the flat vote `content` round-trip. */
const b64enc = (s: string): string => {
  const g = globalThis as { btoa?: (x: string) => string; Buffer?: { from(x: string, e: string): { toString(e: string): string } } };
  const bytes = encodeURIComponent(s).replace(/%([0-9A-F]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
  if (g.btoa) return g.btoa(bytes);
  if (g.Buffer) return g.Buffer.from(s, 'utf-8').toString('base64');
  return s;
};
/** B64dec helper. */
const b64dec = (s: string): string => {
  const g = globalThis as { atob?: (x: string) => string; Buffer?: { from(x: string, e: string): { toString(e: string): string } } };
  try {
    if (g.atob) {
      const bin = g.atob(s);
      return decodeURIComponent(Array.from(bin).map(c => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''));
    }
    if (g.Buffer) return g.Buffer.from(s, 'base64').toString('utf-8');
  } catch { /* fall through */ }
  return s;
};

/** Build the vote `content` for a FREE-TEXT (open) answer to a question. The text is base64-encoded so an answer containing `:` can't break the key. The `open:` prefix makes it unambiguous against a choice key. */
export function openVoteKey(questionIndex: number, text: string): string {
  return `open:${questionIndex}:${b64enc(text)}`;
}

/** Parse an open-answer vote `content`. Returns the question index + decoded text, or null when the string is not an open-vote key. */
export function parseOpenVote(content: string): { q: number; text: string } | null {
  const m = /^open:(\d+):([\s\S]*)$/.exec(content);
  if (!m) return null;
  const q = Number(m[1]);
  if (!Number.isInteger(q)) return null;
  return { q, text: b64dec(m[2] ?? '') };
}

/** Last-write-wins collect of the latest open-answer state per voter for one (poll, question). */
function latestOpenAnswers(
  events: VoteEvent[],
  pollMessageId: string,
  questionIndex: number,
): Map<string, { ts: string; removed: boolean; text: string }> {
  const latest = new Map<string, { ts: string; removed: boolean; text: string }>();
  for (const e of events) {
    if (e.reference !== pollMessageId || e.schema !== 'custom') continue;
    const k = parseOpenVote(e.content);
    if (k?.q !== questionIndex) continue;
    const cur = latest.get(e.voter);
    if (!cur || cur.ts < e.ts) latest.set(e.voter, { ts: e.ts, removed: !!e.removed, text: k.text });
  }
  return latest;
}

/** Latest free-text answer per voter for one (poll, question). A `removed` event (or empty text) clears the voter's answer. Returns voterUri -> {text, ts}. */
export function openAnswersByPoll(
  events: VoteEvent[],
  pollMessageId: string,
  questionIndex = 0,
): Map<string, { text: string; ts: string }> {
  const latest = latestOpenAnswers(events, pollMessageId, questionIndex);
  const out = new Map<string, { text: string; ts: string }>();
  for (const [voter, v] of latest) {
    if (v.removed || !v.text) continue;
    out.set(voter, { text: v.text, ts: v.ts });
  }
  return out;
}

/** A normalized vote event. The minimal shape the tally needs. Both the app envelope (`payload.reactTo`/`emoji`/`removed`/`schema`) and the web client can adapt their reaction events into this. */
export interface VoteEvent {
  /** The XMTP message id this vote targets (poll bubble id). */
  reference: string;
  /** The chosen option index, as the raw reaction `content` string. */
  content: string;
  /** Vote schema: only `custom` events are treated as votes. */
  schema?: string;
  /** true => retract (action:'removed'); false/undefined => cast. */
  removed?: boolean;
  /** Stable identity of the voter (e.g. `metro://xmtp/user/<inboxId>`). */
  voter: string;
  /** ISO timestamp; drives last-write-wins dedup. */
  ts: string;
}

/** Build Map<optionIndex, Set<voterUri>> for one poll: single-select keeps each voter's latest 'added' content, multiSelect tracks latest add/remove per (voter, option); only schema:'custom' events referencing pollMessageId count, so a real emoji reaction is ignored. */
export function votesByPoll(
  events: VoteEvent[],
  pollMessageId: string,
  multiSelect = false,
  questionIndex = 0,
): Map<number, Set<string>> {
  /** Decode an event to its option index for THIS poll + question, or null. */
  const optOf = (e: VoteEvent): number | null => {
    if (e.reference !== pollMessageId || e.schema !== 'custom') return null;
    const k = parseVoteKey(e.content);
    return k?.q === questionIndex ? k.o : null;
  };
  return multiSelect ? multiSelectVotes(events, optOf) : singleSelectVotes(events, optOf);
}

/** Add `voter` to the voter set for `idx` in `out`, creating the set on first use. */
function addVoter(out: Map<number, Set<string>>, idx: number, voter: string): void {
  let s = out.get(idx);
  if (!s) { s = new Set(); out.set(idx, s); }
  s.add(voter);
}

/** Multi-select tally: latest add/remove state per (voter, optionIndex). */
function multiSelectVotes(
  events: VoteEvent[],
  optOf: (e: VoteEvent) => number | null,
): Map<number, Set<string>> {
  const latest = new Map<string, { ts: string; removed: boolean; idx: number; voter: string }>();
  for (const e of events) {
    const idx = optOf(e);
    if (idx === null) continue;
    const key = `${e.voter} ${idx}`;
    const cur = latest.get(key);
    if (!cur || cur.ts < e.ts) latest.set(key, { ts: e.ts, removed: !!e.removed, idx, voter: e.voter });
  }
  const out = new Map<number, Set<string>>();
  for (const v of latest.values()) if (!v.removed) addVoter(out, v.idx, v.voter);
  return out;
}

/** Single-select tally: latest 'added' option per voter wins (a bare removal clears, a switch is the newer 'added'). */
function singleSelectVotes(
  events: VoteEvent[],
  optOf: (e: VoteEvent) => number | null,
): Map<number, Set<string>> {
  const latest = new Map<string, { ts: string; removed: boolean; idx: number }>();
  for (const e of events) {
    const idx = optOf(e);
    if (idx === null) continue;
    const cur = latest.get(e.voter);
    if (!cur || cur.ts < e.ts) latest.set(e.voter, { ts: e.ts, removed: !!e.removed, idx });
  }
  const out = new Map<number, Set<string>>();
  for (const [voter, v] of latest) if (!v.removed) addVoter(out, v.idx, voter);
  return out;
}

/** Option indices the given voter currently has selected on this poll. Drives the highlighted/selected option pills. */
export function ownVotes(
  events: VoteEvent[],
  myVoter: string,
  pollMessageId: string,
  multiSelect = false,
  questionIndex = 0,
): Set<number> {
  const mine = events.filter(e => e.voter === myVoter);
  const tally = votesByPoll(mine, pollMessageId, multiSelect, questionIndex);
  const out = new Set<number>();
  for (const [idx, voters] of tally) if (voters.has(myVoter)) out.add(idx);
  return out;
}
