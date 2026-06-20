
import type { ConsentState } from '@xmtp/react-native-sdk';
import type { HistoryEntry } from './types';
import { isMetroControlBody } from './push';
import { getCachedXmtpClient, convOfLine } from './xmtp.client';
import { envelopeOfXmtpMessage } from './xmtp.messages';
import { feedCache, activeFeedLines } from './xmtp.state';

export const PAGE_SIZE = 20;

export const STREAM_CONSENT_STATES: ConsentState[] = ['allowed', 'unknown'];

export function pushToFeedSlice(line: string, env: HistoryEntry): void {
  const prev = feedCache.get(line) ?? [];
  if (prev.some(e => e.id === env.id)) return;
  feedCache.set(line, [env, ...prev]);
}

let inboxSyncInFlight: Promise<void> | null = null;
let lastInboxSyncAt = 0;
export async function syncInboxOnce(maxAgeMs = 3_000): Promise<void> {
  if (inboxSyncInFlight) return inboxSyncInFlight;
  if (Date.now() - lastInboxSyncAt < maxAgeMs) return;
  inboxSyncInFlight = (async () => {
    try {
      const client = getCachedXmtpClient();
      if (!client) return;
      await client.conversations.syncAllConversations(STREAM_CONSENT_STATES);
      lastInboxSyncAt = Date.now();
    } catch { }
    finally { inboxSyncInFlight = null; }
  })();
  return inboxSyncInFlight;
}

export async function resyncActiveFeeds(): Promise<void> {
  await syncInboxOnce();
  for (const line of activeFeedLines) {
    try {
      const conv = await convOfLine(line);
      if (!conv) continue;
      await conv.sync().catch(() => undefined);
      const msgs = await conv.messages({ limit: PAGE_SIZE });
      for (const m of msgs.reverse()) {
        const env = envelopeOfXmtpMessage(m, line);
        if (!isMetroControlBody(env.text)) pushToFeedSlice(line, env);
      }
    } catch { }
  }
}
