import type { HistoryEntry } from '@stage-labs/client/types';

export interface FeedMerge {
  entries: HistoryEntry[];
  added: number;
}

interface Keyed {
  entry: HistoryEntry;
  index: number;
  ms: number;
}

function sentMs(entry: HistoryEntry): number {
  const ms = Date.parse(entry.ts);
  return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
}

function byNewest(a: Keyed, b: Keyed): number {
  if (a.ms === b.ms) return a.index - b.index;
  return a.ms < b.ms ? 1 : -1;
}

function newestFirst(entries: readonly HistoryEntry[]): HistoryEntry[] {
  return entries
    .map((entry, index) => ({ entry, index, ms: sentMs(entry) }))
    .sort(byNewest)
    .map(({ entry }) => entry);
}

export function mergeFeedEntries(prev: readonly HistoryEntry[], incoming: readonly HistoryEntry[]): FeedMerge {
  const seen = new Set(prev.map(e => e.id));
  const fresh = incoming.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
  if (fresh.length === 0) return { entries: [...prev], added: 0 };
  return { entries: newestFirst([...fresh, ...prev]), added: fresh.length };
}
