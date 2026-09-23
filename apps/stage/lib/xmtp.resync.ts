import type { HistoryEntry } from '@stage-labs/client/types';
import type { ConsentState } from '@xmtp/react-native-sdk';
import { getCachedXmtpClient, convOfLine } from './xmtp.client';
import { latestConvMessages } from './xmtp.messages';
import { PAGE_SIZE, feedResync, throttledInboxSync } from './xmtp.resync.core';

export { PAGE_SIZE, prependToFeed, pushToFeedSlice } from './xmtp.resync.core';

export const STREAM_CONSENT_STATES: ConsentState[] = ['allowed', 'unknown'];

export const syncInboxOnce = throttledInboxSync(async () => {
  const client = getCachedXmtpClient();
  if (!client) return false;
  await client.conversations.syncAllConversations(STREAM_CONSENT_STATES);
  return true;
});

export async function refreshLatestPage(line: string): Promise<HistoryEntry[] | null> {
  const conv = await convOfLine(line);
  if (!conv) return null;
  await conv.sync().catch(() => undefined);
  return latestConvMessages(conv, line, PAGE_SIZE);
}

export const resyncActiveFeeds = feedResync(syncInboxOnce, refreshLatestPage);
