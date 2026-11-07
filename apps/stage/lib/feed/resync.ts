import type { HistoryEntry } from '@stage-labs/client/types';
import { sdk } from '../xmtp.sdk';
import { convOfLine } from '../xmtp.find';
import { latestConvMessages } from '../xmtp.messages';
import { openFeedLines } from './lines';
import { PAGE_SIZE, mergePageIntoFeed } from './merge';
import { recover, report, reported } from '../errorPolicy';
import { syncVisibleChannels } from '../channelVisibility';

async function syncVisibleInbox(): Promise<boolean> {
  const client = sdk.cachedClient();
  if (!client) return false;
  await syncVisibleChannels();
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
  if (await sdk.isActive(conv).catch(recover('xmtp.isActive', true))) await sdk.syncConv(conv).catch(reported('xmtp.convSync'));
  return latestConvMessages(conv, line, PAGE_SIZE);
}

export async function resyncActiveFeeds(): Promise<void> {
  await syncInboxOnce();
  for (const line of openFeedLines()) {
    try {
      const page = await refreshLatestPage(line);
      if (page !== null) mergePageIntoFeed(line, page);
    } catch (err) {
      report('xmtp.feedResync', err);
    }
  }
}
