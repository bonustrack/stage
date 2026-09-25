import type { HistoryEntry } from '@stage-labs/client/types';

export interface FeedMerge {
  entries: HistoryEntry[];
  added: number;
}

interface Keyed {
  entry: HistoryEntry;
  index: number;
  ms: number;
  reaction: boolean;
}

function sentMs(entry: HistoryEntry): number {
  const ms = Date.parse(entry.ts);
  return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
}

function reactionTarget(entry: HistoryEntry): string | undefined {
  const target = (entry.payload as { reactTo?: unknown } | undefined)?.reactTo;
  return typeof target === 'string' && target !== '' ? target : undefined;
}

function byNewest(a: Keyed, b: Keyed): number {
  if (a.ms !== b.ms) return a.ms < b.ms ? 1 : -1;
  if (a.reaction !== b.reaction) return a.reaction ? -1 : 1;
  return a.index - b.index;
}

function keyed(entries: readonly HistoryEntry[]): Keyed[] {
  const msById = new Map(entries.map(e => [e.id, sentMs(e)]));
  return entries.map((entry, index) => {
    const targetId = reactionTarget(entry);
    const targetMs = targetId === undefined ? undefined : msById.get(targetId);
    const ms = targetMs === undefined ? sentMs(entry) : Math.max(sentMs(entry), targetMs);
    return { entry, index, ms, reaction: targetId !== undefined };
  });
}

function newestFirst(entries: readonly HistoryEntry[]): HistoryEntry[] {
  return keyed(entries).sort(byNewest).map(({ entry }) => entry);
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
