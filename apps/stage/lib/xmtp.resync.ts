import type { HistoryEntry } from '@stage-labs/client/types';
import { convOfLine, sdk } from './xmtp.sdk';
import { latestConvMessages } from './xmtp.messages';
import { PAGE_SIZE, feedResync, throttledInboxSync } from './xmtp.resync.core';
import { reported } from './errorPolicy';

export { PAGE_SIZE, prependToFeed, pushToFeedSlice } from './xmtp.resync.core';

export const syncInboxOnce = throttledInboxSync(async () => {
  const client = sdk.cachedClient();
  if (!client) return false;
  await sdk.syncVisible(client);
  return true;
});

export async function refreshLatestPage(line: string): Promise<HistoryEntry[] | null> {
  const conv = await convOfLine(line);
  if (!conv) return null;
  await conv.sync().catch(reported('xmtp.convSync'));
  return latestConvMessages(conv, line, PAGE_SIZE);
}

export const resyncActiveFeeds = feedResync(syncInboxOnce, refreshLatestPage);
