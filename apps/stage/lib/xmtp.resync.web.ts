import { ConsentState } from '@xmtp/browser-sdk';
import { getCachedXmtpClient, convOfLine } from './xmtp.client.web';
import { latestConvMessages } from './xmtp.messages.web';
import { PAGE_SIZE, feedResync, throttledInboxSync } from './xmtp.resync.core';

export { PAGE_SIZE, pushToFeedSlice } from './xmtp.resync.core';

export const STREAM_CONSENT_STATES: ConsentState[] = [ConsentState.Allowed, ConsentState.Unknown];

export const syncInboxOnce = throttledInboxSync(async () => {
  const client = getCachedXmtpClient();
  if (!client) return false;
  await client.conversations.syncAll(STREAM_CONSENT_STATES);
  return true;
});

export const resyncActiveFeeds = feedResync(syncInboxOnce, async (line) => {
  const conv = await convOfLine(line);
  if (!conv) return null;
  await conv.sync().catch(() => undefined);
  return latestConvMessages(conv, line, PAGE_SIZE);
});
