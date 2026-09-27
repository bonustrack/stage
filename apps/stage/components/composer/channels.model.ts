import { displayOf, type Piece, type Span } from './mentions.model';

export interface ChannelCandidate {
  convId: string;
  name: string;
  avatarUri: string | null;
  avatarAddress: string | null;
}

export interface ChannelQuery { text: string; range: Span }

interface ChannelRow {
  convId: string;
  peerAddress?: string | null;
  title?: string | null;
  avatarUri?: string | null;
  avatarAddress?: string | null;
}

const MAX_CHANNEL_MATCHES = 6;

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

export function channelCandidatesOf(rows: readonly ChannelRow[] | null, currentConvId: string): ChannelCandidate[] {
  return (rows ?? []).flatMap((row) => {
    const name = text(row.title);
    if (name === null || row.convId === currentConvId || text(row.peerAddress) !== null) return [];
    const avatarUri = text(row.avatarUri);
    return [{ convId: row.convId, name, avatarUri, avatarAddress: avatarUri ? null : text(row.avatarAddress) }];
  });
}

export function channelQuery(pieces: Piece[], cursor: number): ChannelQuery | null {
  const m = /(^|\s)#(\S*)$/.exec(displayOf(pieces).slice(0, cursor));
  if (!m) return null;
  const typed = m[2] ?? '';
  const start = cursor - typed.length - 1;
  const inside = pieces.some(p => p.mention && start >= p.displayStart && start < p.displayStart + p.display.length);
  return inside ? null : { text: typed, range: { start, end: cursor } };
}

function rankOf(name: string, query: string): number {
  const lower = name.toLowerCase();
  if (lower.startsWith(query)) return 0;
  if (lower.split(/[\s_-]+/).some(word => word.startsWith(query))) return 1;
  return lower.includes(query) ? 2 : -1;
}

export function matchChannels(candidates: ChannelCandidate[], query: string): ChannelCandidate[] {
  const q = query.toLowerCase();
  return candidates
    .map(candidate => ({ candidate, rank: rankOf(candidate.name, q) }))
    .filter(m => m.rank >= 0)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, MAX_CHANNEL_MATCHES)
    .map(m => m.candidate);
}

export function activeChannelIndex(
  matches: ChannelCandidate[],
  key: string,
  active: { key: string; convId: string },
): number {
  if (active.key !== key) return 0;
  return Math.max(0, matches.findIndex(c => c.convId === active.convId));
}
