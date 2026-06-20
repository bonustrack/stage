
export function parseVoteKey(content: string): { q: number; o: number } | null {
  const m = /^(?:(\d+):)?(\d+)$/.exec(content);
  if (!m) return null;
  const q = m[1] === undefined ? 0 : Number(m[1]);
  const o = Number(m[2]);
  if (!Number.isInteger(q) || !Number.isInteger(o)) return null;
  return { q, o };
}

export function voteKey(questionIndex: number, optionIndex: number): string {
  return questionIndex === 0 ? String(optionIndex) : `${questionIndex}:${optionIndex}`;
}

const b64enc = (s: string): string => {
  const g = globalThis as { btoa?: (x: string) => string; Buffer?: { from(x: string, e: string): { toString(e: string): string } } };
  const bytes = encodeURIComponent(s).replace(/%([0-9A-F]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
  if (g.btoa) return g.btoa(bytes);
  if (g.Buffer) return g.Buffer.from(s, 'utf-8').toString('base64');
  return s;
};
const b64dec = (s: string): string => {
  const g = globalThis as { atob?: (x: string) => string; Buffer?: { from(x: string, e: string): { toString(e: string): string } } };
  try {
    if (g.atob) {
      const bin = g.atob(s);
      return decodeURIComponent(Array.from(bin).map(c => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''));
    }
    if (g.Buffer) return g.Buffer.from(s, 'base64').toString('utf-8');
  } catch { }
  return s;
};

export function openVoteKey(questionIndex: number, text: string): string {
  return `open:${questionIndex}:${b64enc(text)}`;
}

export function parseOpenVote(content: string): { q: number; text: string } | null {
  const m = /^open:(\d+):([\s\S]*)$/.exec(content);
  if (!m) return null;
  const q = Number(m[1]);
  if (!Number.isInteger(q)) return null;
  return { q, text: b64dec(m[2] ?? '') };
}

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

export interface VoteEvent {
  reference: string;
  content: string;
  schema?: string;
  removed?: boolean;
  voter: string;
  ts: string;
}

export function votesByPoll(
  events: VoteEvent[],
  pollMessageId: string,
  multiSelect = false,
  questionIndex = 0,
): Map<number, Set<string>> {
  const optOf = (e: VoteEvent): number | null => {
    if (e.reference !== pollMessageId || e.schema !== 'custom') return null;
    const k = parseVoteKey(e.content);
    return k?.q === questionIndex ? k.o : null;
  };
  return multiSelect ? multiSelectVotes(events, optOf) : singleSelectVotes(events, optOf);
}

function addVoter(out: Map<number, Set<string>>, idx: number, voter: string): void {
  let s = out.get(idx);
  if (!s) { s = new Set(); out.set(idx, s); }
  s.add(voter);
}

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
