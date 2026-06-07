/** Pure poll-vote tally helpers + the vote-key wire codec. Split out of poll.ts
 *  to keep both files under the lint line cap. Votes are reaction events
 *  (schema:'custom') whose `reference` is the poll message id and whose `content`
 *  is the vote key (`"q:o"`, or a BARE option index for question 0 / legacy). */

/** Parse a vote `content` string into its (questionIndex, optionIndex). The wire
 *  form is `"q:o"`; a BARE integer (legacy single-question votes) is question 0.
 *  Returns null when the string is not a valid vote key. */
export function parseVoteKey(content: string): { q: number; o: number } | null {
  const m = /^(?:(\d+):)?(\d+)$/.exec(content);
  if (!m) return null;
  const q = m[1] === undefined ? 0 : Number(m[1]);
  const o = Number(m[2]);
  if (!Number.isInteger(q) || !Number.isInteger(o)) return null;
  return { q, o };
}

/** Build the vote `content` string for a (questionIndex, optionIndex). Question 0
 *  emits a BARE option index so legacy single-question clients (and the existing
 *  tally) keep decoding it; other questions use the `"q:o"` form. */
export function voteKey(questionIndex: number, optionIndex: number): string {
  return questionIndex === 0 ? String(optionIndex) : `${questionIndex}:${optionIndex}`;
}

/** A normalized vote event. The minimal shape the tally needs. Both the app
 *  envelope (`payload.reactTo`/`emoji`/`removed`/`schema`) and the web client
 *  can adapt their reaction events into this. */
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

/** Build `Map<optionIndex, Set<voterUri>>` for one poll from raw vote events.
 *  - single-select: each voter's latest `added` content wins (one option/voter).
 *  - multiSelect: latest add/remove state per (voter, optionIndex).
 *  Only `schema === 'custom'` events referencing `pollMessageId` count; a real
 *  emoji reaction on the same bubble is ignored. */
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
    return k && k.q === questionIndex ? k.o : null;
  };
  if (multiSelect) {
    // latest add/remove state per (voter, optionIndex)
    const latest = new Map<string, { ts: string; removed: boolean; idx: number; voter: string }>();
    for (const e of events) {
      const idx = optOf(e);
      if (idx === null) continue;
      const key = `${e.voter} ${idx}`;
      const cur = latest.get(key);
      if (!cur || cur.ts < e.ts) latest.set(key, { ts: e.ts, removed: !!e.removed, idx, voter: e.voter });
    }
    const out = new Map<number, Set<string>>();
    for (const v of latest.values()) {
      if (v.removed) continue;
      let s = out.get(v.idx);
      if (!s) { s = new Set(); out.set(v.idx, s); }
      s.add(v.voter);
    }
    return out;
  }
  // single-select: latest 'added' option per voter wins (ignore removals; a
  // bare removal just clears, a switch is the newer 'added').
  const latest = new Map<string, { ts: string; removed: boolean; idx: number }>();
  for (const e of events) {
    const idx = optOf(e);
    if (idx === null) continue;
    const cur = latest.get(e.voter);
    if (!cur || cur.ts < e.ts) latest.set(e.voter, { ts: e.ts, removed: !!e.removed, idx });
  }
  const out = new Map<number, Set<string>>();
  for (const [voter, v] of latest) {
    if (v.removed) continue;
    let s = out.get(v.idx);
    if (!s) { s = new Set(); out.set(v.idx, s); }
    s.add(voter);
  }
  return out;
}

/** Option indices the given voter currently has selected on this poll. Drives
 *  the highlighted/selected option pills. */
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
