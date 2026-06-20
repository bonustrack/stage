/** @file Inbox-wide catch-up sync (`syncInboxOnce`) and active-feed resync backstop for the XMTP client lib, catching messages the native stream dropped while backgrounded; split from xmtp.stream.ts for the line cap. */

import type { ConsentState } from '@xmtp/react-native-sdk';
import type { HistoryEntry } from './types';
import { isMetroControlBody } from './push';
import { getCachedXmtpClient, convOfLine } from './xmtp.client';
import { envelopeOfXmtpMessage } from './xmtp.messages';
import { feedCache, activeFeedLines } from './xmtp.state';

/** First-page + per-scroll-up page size. Opening a conversation used to decode 100 messages up front (~150–220ms on-device, on the critical path before first paint); a small first page paints fast and older pages stream in on scroll-up. */
export const PAGE_SIZE = 20;

/** Match the daemon's fan-out: deliver Allowed + Unknown conversations (skip explicitly denied). `ConsentState` is a string-literal union in the RN SDK (not a runtime enum), so we pass the literals with the type for clarity. */
export const STREAM_CONSENT_STATES: ConsentState[] = ['allowed', 'unknown'];

/** Append a decoded message to a conv's cached slice (newest-first, deduped), notifying that slice's subscribers via the MemoryStore. Returns nothing. */
export function pushToFeedSlice(line: string, env: HistoryEntry): void {
  const prev = feedCache.get(line) ?? [];
  if (prev.some(e => e.id === env.id)) return;
  feedCache.set(line, [env, ...prev]);
}

/** Coalesced top-level inbox sync: only inbox-wide `syncAllConversations` lands MLS-commit messages that arrived while the stream was dead, so it runs before fetching the open conv; coalesced on one in-flight promise + a 3s window so concurrent callers share a single network pass. */
let inboxSyncInFlight: Promise<void> | null = null;
let lastInboxSyncAt = 0;
/** Coalesced, freshness-windowed sync of the XMTP inbox so concurrent callers share one network pass. */
export async function syncInboxOnce(maxAgeMs = 3_000): Promise<void> {
  if (inboxSyncInFlight) return inboxSyncInFlight;
  if (Date.now() - lastInboxSyncAt < maxAgeMs) return;
  inboxSyncInFlight = (async () => {
    try {
      const client = getCachedXmtpClient();
      if (!client) return;
      await client.conversations.syncAllConversations(STREAM_CONSENT_STATES);
      lastInboxSyncAt = Date.now();
    } catch { /* best-effort — per-conv sync + next pass still retry */ }
    finally { inboxSyncInFlight = null; }
  })();
  return inboxSyncInFlight;
}

/** Resync the subscribed conv slices from the local store as a cheap backstop, running an inbox-wide sync first (coalesced) so backgrounded messages land in the local DB before each conv's tail is read. */
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
    } catch { /* best-effort — next tick retries */ }
  }
}
