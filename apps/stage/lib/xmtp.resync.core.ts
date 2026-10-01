import type { HistoryEntry } from '@stage-labs/client/types';
import { isControlBody } from './xmtp.types';
import { feedCache, activeFeedLines } from './xmtp.state.core';
import { report } from './errorPolicy';
import { mergeFeedEntries, type FeedMerge } from './feedOrder.model';
import { markFeedStart } from './feedStart';
import { makeListeners } from './storeCore';

export const PAGE_SIZE = 20;

const channelUpdates = makeListeners<string>();

export const subscribeChannelUpdates = channelUpdates.subscribe;

export function mergeIntoFeed(line: string, entries: readonly HistoryEntry[]): FeedMerge {
  const merged = mergeFeedEntries(feedCache.get(line) ?? [], entries.filter(e => !isControlBody(e.text)));
  if (merged.added > 0 || merged.replaced > 0) feedCache.set(line, merged.entries);
  if (merged.channelUpdated) channelUpdates.notify(line);
  return merged;
}

export function mergePageIntoFeed(line: string, page: readonly HistoryEntry[], older = false): void {
  const { entries, added } = mergeIntoFeed(line, page);
  if (page.length < PAGE_SIZE || (older && added === 0)) markFeedStart(line, entries[entries.length - 1]?.id ?? '');
}

export function throttledInboxSync(syncAll: () => Promise<boolean>): (maxAgeMs?: number) => Promise<void> {
  let inFlight: Promise<void> | null = null;
  let lastAt = 0;
  return async (maxAgeMs = 3_000): Promise<void> => {
    if (inFlight) return inFlight;
    if (Date.now() - lastAt < maxAgeMs) return;
    inFlight = (async () => {
      try {
        if (await syncAll()) lastAt = Date.now();
      } catch (err) {
        report('xmtp.inboxSync', err);
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  };
}

export function feedResync(
  syncInbox: () => Promise<void>,
  latestPage: (line: string) => Promise<HistoryEntry[] | null>,
): () => Promise<void> {
  return async (): Promise<void> => {
    await syncInbox();
    for (const line of activeFeedLines) {
      try {
        const page = await latestPage(line);
        if (page !== null) mergePageIntoFeed(line, page);
      } catch (err) {
        report('xmtp.feedResync', err);
      }
    }
  };
}
