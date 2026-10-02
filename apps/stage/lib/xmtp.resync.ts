import type { HistoryEntry } from '@stage-labs/client/types';
import { convOfLine, sdk } from './xmtp.sdk';
import { latestConvMessages } from './xmtp.messages';
import { isControlBody } from './xmtp.types';
import { feedCache, activeFeedLines } from './xmtp.state.core';
import { recover, report, reported } from './errorPolicy';
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

async function syncVisibleInbox(): Promise<boolean> {
  const client = sdk.cachedClient();
  if (!client) return false;
  await sdk.syncVisible(client);
  return true;
}

let inboxSyncInFlight: Promise<void> | null = null;
let lastInboxSyncAt = 0;

export async function syncInboxOnce(maxAgeMs = 3_000): Promise<void> {
  if (inboxSyncInFlight) return inboxSyncInFlight;
  if (Date.now() - lastInboxSyncAt < maxAgeMs) return;
  inboxSyncInFlight = (async () => {
    try {
      if (await syncVisibleInbox()) lastInboxSyncAt = Date.now();
    } catch (err) {
      report('xmtp.inboxSync', err);
    } finally {
      inboxSyncInFlight = null;
    }
  })();
  return inboxSyncInFlight;
}

export async function refreshLatestPage(line: string): Promise<HistoryEntry[] | null> {
  const conv = await convOfLine(line);
  if (!conv) return null;
  if (await sdk.isActive(conv).catch(recover('xmtp.isActive', true))) await conv.sync().catch(reported('xmtp.convSync'));
  return latestConvMessages(conv, line, PAGE_SIZE);
}

export async function resyncActiveFeeds(): Promise<void> {
  await syncInboxOnce();
  for (const line of activeFeedLines) {
    try {
      const page = await refreshLatestPage(line);
      if (page !== null) mergePageIntoFeed(line, page);
    } catch (err) {
      report('xmtp.feedResync', err);
    }
  }
}
