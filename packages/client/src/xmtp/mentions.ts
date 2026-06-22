
export interface MentionCandidate {
  address: string;
  name: string;
}

export type MentionSegment =
  | { type: 'text'; text: string }
  | { type: 'mention'; address: string };

export const MENTION_RE = /@(0x[0-9a-fA-F]{40})\b/g;

export function formatMention(address: string): string {
  return `@${address.toLowerCase()} `;
}

export function hasMention(text: string): boolean {
  MENTION_RE.lastIndex = 0;
  const found = MENTION_RE.test(text);
  MENTION_RE.lastIndex = 0;
  return found;
}

export function parseMentions(text: string): MentionSegment[] {
  const segments: MentionSegment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  MENTION_RE.lastIndex = 0;
  while ((m = MENTION_RE.exec(text)) !== null) {
    if (m.index > last) segments.push({ type: 'text', text: text.slice(last, m.index) });
    segments.push({ type: 'mention', address: (m[1] ?? m[0]).toLowerCase() });
    last = m.index + m[0].length;
  }
  if (last < text.length) segments.push({ type: 'text', text: text.slice(last) });
  return segments;
}

export interface MentionQuery {
  matches: MentionCandidate[];
  range: { start: number; end: number } | null;
}

export function computeMentionQuery(
  text: string,
  cursor: number,
  candidates: MentionCandidate[] | undefined,
  limit = 6,
): MentionQuery {
  if (!candidates || candidates.length === 0) return { matches: [], range: null };
  const before = text.slice(0, cursor);
  const m = /(^|\s)@(\S*)$/.exec(before);
  if (!m) return { matches: [], range: null };
  const query = (m[2] ?? '').toLowerCase();
  const start = cursor - query.length - 1;
  const matches = matchMembers(candidates, query, limit);
  return { matches, range: { start, end: cursor } };
}

export function matchMembers<T extends MentionCandidate>(
  candidates: T[],
  query: string,
  limit = 6,
): T[] {
  const q = query.toLowerCase();
  return candidates
    .filter(c => !q || c.name.toLowerCase().includes(q) || c.address.toLowerCase().includes(q))
    .slice(0, limit);
}

export function applyMention(
  text: string,
  range: { start: number; end: number },
  address: string,
): { next: string; cursor: number } {
  const insert = formatMention(address);
  const next = text.slice(0, range.start) + insert + text.slice(range.end);
  return { next, cursor: range.start + insert.length };
}
