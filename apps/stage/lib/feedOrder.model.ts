import type { HistoryEntry } from '@stage-labs/client/types';
import { isDeletedPlaceholder } from '@stage-labs/client/xmtp/deletions';
import { isSystemEntry } from '@stage-labs/client/xmtp/envelope';
import { uniqueBy } from '@stage-labs/client/collections';

export interface FeedMerge {
  entries: HistoryEntry[];
  added: number;
  replaced: number;
  channelUpdated: boolean;
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

export function reactionTarget(entry: HistoryEntry): string | undefined {
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

function withDeletedPlaceholders(
  prev: readonly HistoryEntry[], incoming: readonly HistoryEntry[],
): { entries: readonly HistoryEntry[]; replaced: number } {
  const placeholders = new Map(incoming.filter(isDeletedPlaceholder).map(e => [e.id, e]));
  let replaced = 0;
  const entries = placeholders.size === 0 ? prev : prev.map((e) => {
    const placeholder = placeholders.get(e.id);
    if (placeholder === undefined || isDeletedPlaceholder(e)) return e;
    replaced += 1;
    return placeholder;
  });
  return { entries, replaced };
}

export function mergeFeedEntries(prev: readonly HistoryEntry[], incoming: readonly HistoryEntry[]): FeedMerge {
  const { entries: base, replaced } = withDeletedPlaceholders(prev, incoming);
  const fresh = uniqueBy(incoming, e => e.id, new Set(base.map(e => e.id)));
  if (fresh.length === 0) return { entries: [...base], added: 0, replaced, channelUpdated: false };
  return { entries: newestFirst([...fresh, ...base]), added: fresh.length, replaced, channelUpdated: fresh.some(isSystemEntry) };
}

export function settleCachedFeed(
  slice: readonly HistoryEntry[], cachedIds: ReadonlySet<string>, page: readonly HistoryEntry[],
): FeedMerge {
  return mergeFeedEntries(slice.filter(e => !cachedIds.has(e.id)), page);
}

export function withNestedReactions<M>(
  newestFirst: readonly M[],
  reactionsOf: (m: M) => readonly M[],
  sentNsOf: (m: M) => number,
): M[] {
  const pending = newestFirst
    .flatMap((m) => reactionsOf(m).map((r) => ({ r, ns: Math.max(sentNsOf(r), sentNsOf(m)) })))
    .sort((a, b) => b.ns - a.ns);
  return newestFirst.flatMap((m) => {
    const cut = pending.findIndex((p) => p.ns < sentNsOf(m));
    return [...pending.splice(0, cut === -1 ? pending.length : cut).map((p) => p.r), m];
  });
}
