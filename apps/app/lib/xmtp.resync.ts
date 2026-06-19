/** Inbox-wide catch-up sync + active-feed resync backstop for the app's XMTP
 *  client lib. Extracted from xmtp.stream.ts (lint split) so the stream module
 *  stays under the 200-line cap. The single global stream (xmtp.stream.ts) and
 *  the open feed (xmtp.feed.ts) both lean on `syncInboxOnce` to catch messages
 *  the native stream dropped while backgrounded. */

import type { ConsentState } from '@xmtp/react-native-sdk';
import type { HistoryEntry } from './types';
import { isMetroControlBody } from './push';
import { getCachedXmtpClient, convOfLine } from './xmtp.client';
import { envelopeOfXmtpMessage } from './xmtp.messages';
import { feedCache, activeFeedLines } from './xmtp.state';

/** First-page + per-scroll-up page size. Opening a conversation used to decode
 *  100 messages up front (~150–220ms on-device, on the critical path before first
 *  paint); a small first page paints fast and older pages stream in on scroll-up. */
export const PAGE_SIZE = 20;

/** Match the daemon's fan-out: deliver Allowed + Unknown conversations (skip
 *  explicitly denied). `ConsentState` is a string-literal union in the RN SDK
 *  (not a runtime enum), so we pass the literals with the type for clarity. */
export const STREAM_CONSENT_STATES: ConsentState[] = ['allowed', 'unknown'];

/** Append a decoded message to a conv's cached slice (newest-first, deduped),
 *  notifying that slice's subscribers via the MemoryStore. Returns nothing. */
export function pushToFeedSlice(line: string, env: HistoryEntry): void {
  const prev = feedCache.get(line) ?? [];
  if (prev.some(e => e.id === env.id)) return;
  feedCache.set(line, [env, ...prev]);
}

/** Coalesced top-level inbox sync. A per-conv `conv.sync()` on a
 *  `findConversation` handle does NOT reliably land messages that arrived via
 *  MLS group commits while the native stream was dead/backgrounded — only the
 *  inbox-wide `syncAllConversations` processes those welcome/commit/application
 *  envelopes into the local DB (this is why the CHANNELS LIST, which calls it,
 *  saw the latest message the OPEN FEED missed). We run it before fetching the
 *  open conv's messages so re-open / foreground reflects the true network tail.
 *
 *  Coalesced on a single in-flight promise + a 3s freshness window so the
 *  open-effect, the foreground resume, the stream-death backstop and the 7s
 *  poll can all ask for "sync the inbox" without N concurrent network passes
 *  hammering the read-rate limit that previously caused an outage. */
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

/** Resync the currently-subscribed conv slices from the local store. Cheap
 *  backstop for anything the native stream dropped. Runs an inbox-wide sync
 *  FIRST (coalesced) so messages delivered while backgrounded land in the local
 *  DB before we read each conv's tail — a bare per-conv `conv.sync()` misses
 *  them. */
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
