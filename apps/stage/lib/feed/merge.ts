import type { HistoryEntry } from '@stage-labs/client/types';
import { isShownInFeed } from '@stage-labs/client/xmtp/visibility';
import { feedCache } from './cache';
import { mergeFeedEntries, settleCachedFeed, type FeedMerge } from './order.model';
import { markFeedStart } from './start';
import { makeListeners } from '../storeCore';

export const PAGE_SIZE = 20;

const channelUpdates = makeListeners<string>();

export const subscribeChannelUpdates = channelUpdates.subscribe;

function applyMerge(line: string, merged: FeedMerge, always: boolean): FeedMerge {
  if (always || merged.added > 0 || merged.replaced > 0) feedCache.set(line, merged.entries);
  if (merged.channelUpdated) channelUpdates.notify(line);
  return merged;
}

function shown(entries: readonly HistoryEntry[]): HistoryEntry[] {
  return entries.filter(isShownInFeed);
}

export function mergeIntoFeed(line: string, entries: readonly HistoryEntry[]): FeedMerge {
  return applyMerge(line, mergeFeedEntries(feedCache.get(line) ?? [], shown(entries)), false);
}

export function mergeLatestIntoFeed(line: string, page: readonly HistoryEntry[]): FeedMerge {
  const cached = feedCache.cachedIds(line);
  if (cached === undefined) return mergeIntoFeed(line, page);
  feedCache.settleCached(line);
  return applyMerge(line, settleCachedFeed(feedCache.get(line) ?? [], cached, shown(page)), true);
}

export function mergePageIntoFeed(line: string, page: readonly HistoryEntry[], older = false): void {
  const { entries, added } = older ? mergeIntoFeed(line, page) : mergeLatestIntoFeed(line, page);
  if (page.length < PAGE_SIZE || (older && added === 0)) markFeedStart(line, entries[entries.length - 1]?.id ?? '');
}
