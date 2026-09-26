import { MENTION_RE, applyMention, computeMentionQuery, type MentionCandidate } from '@stage-labs/client/xmtp/mentions';

export interface Span { start: number; end: number }

export type LabelOf = (address: string) => string;

interface Part { wire: string; display: string; mention: boolean }

export interface Piece extends Part { wireStart: number; displayStart: number }

export interface DisplayEdit { wire: string; display: string; caret: number }

export type MentionKeyAction =
  | { kind: 'move'; index: number }
  | { kind: 'pick' }
  | { kind: 'dismiss' };

function plain(text: string): Part {
  return { wire: text, display: text, mention: false };
}

function place(parts: Part[]): Piece[] {
  let wireStart = 0;
  let displayStart = 0;
  return parts.map((part) => {
    const piece = { ...part, wireStart, displayStart };
    wireStart += part.wire.length;
    displayStart += part.display.length;
    return piece;
  });
}

export function piecesOf(wire: string, labelOf: LabelOf): Piece[] {
  const parts: Part[] = [];
  let last = 0;
  for (const m of wire.matchAll(MENTION_RE)) {
    if (m.index > last) parts.push(plain(wire.slice(last, m.index)));
    parts.push({ wire: m[0], display: labelOf((m[1] ?? m[0]).toLowerCase()), mention: true });
    last = m.index + m[0].length;
  }
  if (last < wire.length) parts.push(plain(wire.slice(last)));
  return place(parts);
}

export function displayOf(pieces: Part[]): string {
  return pieces.map(p => p.display).join('');
}

function wireOf(parts: Part[]): string {
  return parts.map(p => p.wire).join('');
}

export function toDisplay(wire: string, labelOf: LabelOf): string {
  return displayOf(piecesOf(wire, labelOf));
}

function fits(prev: string, next: string, start: number, end: number): boolean {
  if (start < 0 || end > prev.length || start > end) return false;
  const tail = prev.length - end;
  if (next.length < start + tail) return false;
  return prev.slice(0, start) === next.slice(0, start) && prev.slice(end) === next.slice(next.length - tail);
}

function diffRegion(prev: string, next: string): Span {
  const max = Math.min(prev.length, next.length);
  let head = 0;
  while (head < max && prev[head] === next[head]) head += 1;
  let tail = 0;
  while (tail < max - head && prev[prev.length - 1 - tail] === next[next.length - 1 - tail]) tail += 1;
  return { start: head, end: prev.length - tail };
}

export function editRegion(prev: string, next: string, hint: Span): Span {
  const a = Math.min(hint.start, hint.end);
  const b = Math.max(hint.start, hint.end);
  const shrink = prev.length - next.length;
  const tries: Span[] = [{ start: a, end: b }];
  if (a === b && shrink > 0) tries.push({ start: a - shrink, end: a }, { start: a, end: a + shrink });
  return tries.find(t => fits(prev, next, t.start, t.end)) ?? diffRegion(prev, next);
}

function touches(piece: Piece, region: Span): boolean {
  if (!piece.mention) return false;
  const end = piece.displayStart + piece.display.length;
  if (region.start === region.end) return region.start > piece.displayStart && region.start < end;
  return region.start < end && region.end > piece.displayStart;
}

function sliceParts(pieces: Piece[], from: number, to: number): Part[] {
  return pieces.flatMap((p) => {
    const start = Math.max(from, p.displayStart);
    const end = Math.min(to, p.displayStart + p.display.length);
    if (end <= start) return [];
    if (p.mention) return [{ wire: p.wire, display: p.display, mention: true }];
    return [plain(p.display.slice(start - p.displayStart, end - p.displayStart))];
  });
}

function unglue(parts: Part[]): Part[] {
  return parts.map((p, i) => (p.mention && /^\w/.test(wireOf(parts.slice(i + 1))) ? plain(p.display) : p));
}

export function applyDisplayEdit(wire: string, next: string, labelOf: LabelOf, hint: Span): DisplayEdit {
  const before = piecesOf(wire, labelOf);
  const prev = displayOf(before);
  if (next === prev) return { wire, display: prev, caret: Math.min(hint.end, prev.length) };
  const region = editRegion(prev, next, hint);
  const inserted = next.slice(region.start, next.length - (prev.length - region.end));
  const kept = place(before.map(p => (touches(p, region) ? plain(p.display) : p)));
  const parts = unglue([...sliceParts(kept, 0, region.start), plain(inserted), ...sliceParts(kept, region.end, prev.length)]);
  const nextWire = wireOf(parts);
  const display = toDisplay(nextWire, labelOf);
  const caret = Math.max(0, Math.min(display.length, display.length - (prev.length - region.end)));
  return { wire: nextWire, display, caret };
}

export function insertMention(wire: string, range: Span, address: string, labelOf: LabelOf): { wire: string; caret: number } {
  const pieces = piecesOf(wire, labelOf);
  const wireAt = (pos: number): number => wireOf(sliceParts(pieces, 0, pos)).length;
  const { next, cursor } = applyMention(wire, { start: wireAt(range.start), end: wireAt(range.end) }, address);
  return { wire: next, caret: toDisplay(next.slice(0, cursor), labelOf).length };
}

export function mentionQuery(
  pieces: Piece[],
  cursor: number,
  candidates: MentionCandidate[] | undefined,
): { matches: MentionCandidate[]; range: Span | null } {
  const { matches, range } = computeMentionQuery(displayOf(pieces), cursor, candidates);
  if (!range) return { matches: [], range: null };
  const inside = pieces.some(p => p.mention && range.start >= p.displayStart && range.start < p.displayStart + p.display.length);
  return inside ? { matches: [], range: null } : { matches, range };
}

export function mentionKeyAction(key: string, shift: boolean, count: number, active: number): MentionKeyAction | null {
  if (count === 0) return null;
  if (key === 'ArrowDown') return { kind: 'move', index: (active + 1) % count };
  if (key === 'ArrowUp') return { kind: 'move', index: (active - 1 + count) % count };
  if ((key === 'Enter' && !shift) || key === 'Tab') return { kind: 'pick' };
  if (key === 'Escape') return { kind: 'dismiss' };
  return null;
}
