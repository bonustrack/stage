/** Single app-wide XMTP message stream + its resync backstops for the app's XMTP
 *  client lib. Extracted from lib/xmtp.ts (phase-2 lint split); `subscribeAllMessages`
 *  is re-exported from lib/xmtp.ts. `useXmtpFeed` (in xmtp.feed.ts) subscribes to the
 *  feedCache slices this module writes.
 *
 *  ───────────────────────────────────────────────────────────────────────────
 *  SINGLE GLOBAL MESSAGE STREAM (#6)
 *
 *  Previously every open `useXmtpFeed` started its OWN per-conversation
 *  `streamMessages` + a 5s `setInterval` poll. With several channels open that
 *  meant N native streams + N polls hammering the XMTP read-rate limit (which
 *  previously caused an outage) and the battery.
 *
 *  Now there is exactly ONE module-level `streamAllMessages` fan-out for the
 *  whole app. Each inbound message is decoded once, routed into the relevant
 *  conv's `feedCache` slice, and pushed to that slice's subscribers. A single
 *  low-frequency (30s) global resync + an AppState-resume resync act as the only
 *  backstops (the RN native stream can silently die on backgrounding/blips).
 *  ─────────────────────────────────────────────────────────────────────────── */

import { AppState } from 'react-native';
import type { ConsentState } from '@xmtp/react-native-sdk';
import type { HistoryEntry } from './types';
import { isMetroControlBody } from './push';
import { getCachedXmtpClient, getOrCreateXmtpClient, convOfLine } from './xmtp.client';
import { envelopeOfXmtpMessage } from './xmtp.messages';
import { feedCache, activeFeedLines, registerGlobalStreamTeardown } from './xmtp.state';
import { lineOfConv, type StreamMsg } from './xmtp.types';

/** First-page + per-scroll-up page size. Opening a conversation used to decode
 *  100 messages up front (~150–220ms on-device, on the critical path before first
 *  paint); a small first page paints fast and older pages stream in on scroll-up. */
export const PAGE_SIZE = 20;

/** Append a decoded message to a conv's cached slice (newest-first, deduped),
 *  notifying that slice's subscribers via the MemoryStore. Returns nothing. */
export function pushToFeedSlice(line: string, env: HistoryEntry): void {
  const prev = feedCache.get(line) ?? [];
  if (prev.some(e => e.id === env.id)) return;
  feedCache.set(line, [env, ...prev]);
}

/** Channels-list subscribers to the SINGLE global stream (#1). index.tsx
 *  subscribes here instead of starting its own `streamAllMessages`, so each
 *  inbound is decoded once and routed to BOTH the feedCache slice (conv view)
 *  AND these subscribers (row/preview/unread bookkeeping). */
const streamSubscribers = new Set<(m: StreamMsg) => void>();
export function subscribeAllMessages(cb: (m: StreamMsg) => void): () => void {
  streamSubscribers.add(cb);
  /** Ensure the one app-wide stream is running once anyone subscribes. */
  void ensureGlobalStream();
  return () => { streamSubscribers.delete(cb); };
}

/** Match the daemon's fan-out: deliver Allowed + Unknown conversations (skip
 *  explicitly denied). `ConsentState` is a string-literal union in the RN SDK
 *  (not a runtime enum), so we pass the literals with the type for clarity. */
const STREAM_CONSENT_STATES: ConsentState[] = ['allowed', 'unknown'];

let globalStreamCancel: (() => void) | null = null;
let globalStreamStarting = false;
let globalStreamRearmTimer: ReturnType<typeof setTimeout> | null = null;
let globalResyncTimer: ReturnType<typeof setInterval> | null = null;
let globalAppStateSub: { remove: () => void } | null = null;

/** Resync the currently-subscribed conv slices from the local store. Cheap
 *  backstop for anything the native stream dropped. */
async function resyncActiveFeeds(): Promise<void> {
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

/** Re-arm the global stream after a short debounce. Used by `onClose` so a
 *  dropped native stream auto-restarts instead of silently degrading to the
 *  low-frequency resync poll. */
function rearmGlobalStream(): void {
  if (globalStreamRearmTimer) return;
  globalStreamRearmTimer = setTimeout(() => {
    globalStreamRearmTimer = null;
    void ensureGlobalStream();
  }, 500);
}

/** Subscribe the one native fan-out for every conversation on this inbox. Maps
 *  each message to its metro line and routes it into the matching feedCache
 *  slice + channels-list subscribers. Re-armed via `onClose` on native drop. */
async function startStream(client: Awaited<ReturnType<typeof getOrCreateXmtpClient>>): Promise<void> {
  await client.conversations.streamAllMessages(
    async (msg) => {
      if (!msg) return;
      const convId = (msg as unknown as { conversationId?: string }).conversationId
        ?? convIdFromTopicStr((msg as unknown as { topic?: string }).topic);
      /** Fan out the raw message to channels-list subscribers FIRST (#1) — they
       *  do their own control-DM filtering + need the raw msg for preview/sender.
       *  One decode, two consumers. */
      if (streamSubscribers.size > 0) {
        for (const cb of streamSubscribers) { try { cb({ convId: convId ?? null, msg }); } catch { /* ignore */ } }
      }
      if (!convId) return;
      const line = lineOfConv(convId);
      const env = envelopeOfXmtpMessage(msg, line);
      if (isMetroControlBody(env.text)) return;
      pushToFeedSlice(line, env);
    },
    'all',
    STREAM_CONSENT_STATES,
    () => {
      /** Native stream closed (backgrounding/blip). Drop the stale cancel,
       *  resync the active feed once to cover the gap, then re-arm. */
      globalStreamCancel = null;
      void resyncActiveFeeds();
      rearmGlobalStream();
    },
  );
}

/** Lazily start the single app-wide message stream + its backstops. Idempotent;
 *  safe to call from every `useXmtpFeed` mount. */
export async function ensureGlobalStream(): Promise<void> {
  if (globalStreamCancel || globalStreamStarting) return;
  globalStreamStarting = true;
  try {
    const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
    await startStream(client);
    /** Cancellation is via the SDK's imperative `cancelStreamAllMessages` (the
     *  stream starter itself resolves to void). */
    globalStreamCancel = () => {
      try { client.conversations.cancelStreamAllMessages(); } catch { /* ignore */ }
    };
    /** Low-frequency global resync backstop — only touches the active/open conv
     *  (1 conv, PAGE_SIZE 20) so the rate-limit blast radius stays tiny. */
    if (!globalResyncTimer) globalResyncTimer = setInterval(() => { void resyncActiveFeeds(); }, 7_000);
    if (!globalAppStateSub) {
      globalAppStateSub = AppState.addEventListener('change', (state) => {
        if (state !== 'active') return;
        void resyncActiveFeeds();
        /** Stream may have died while backgrounded (onClose nulled the cancel) —
         *  restart it in addition to the one-off resync. */
        if (!globalStreamCancel) void ensureGlobalStream();
      });
    }
  } catch { /* stream init failed — resync backstop still covers active feeds */ }
  finally { globalStreamStarting = false; }
}

/** Tear down the global stream + backstops. Called when the active account
 *  changes so the next account starts a fresh stream against its own inbox. */
function teardownGlobalStream(): void {
  if (globalStreamCancel) { globalStreamCancel(); globalStreamCancel = null; }
  if (globalStreamRearmTimer) { clearTimeout(globalStreamRearmTimer); globalStreamRearmTimer = null; }
  if (globalResyncTimer) { clearInterval(globalResyncTimer); globalResyncTimer = null; }
  if (globalAppStateSub) { try { globalAppStateSub.remove(); } catch { /* ignore */ } globalAppStateSub = null; }
}
/** Wire teardown into the shared state so the client module's
 *  `resetClientScopedState` can stop the stream on account switch without
 *  importing this module (which would re-create the dependency cycle). */
registerGlobalStreamTeardown(teardownGlobalStream);

/** Extract a conv id from an MLS topic (`/xmtp/mls/1/g-<hexId>/proto`). The RN
 *  `DecodedMessage` from `streamAllMessages` exposes `topic` but not always
 *  `conversationId`. */
function convIdFromTopicStr(topic: string | undefined): string | null {
  if (!topic) return null;
  const m = /\/g-([0-9a-fA-F]+)\//.exec(topic);
  return m ? m[1]! : null;
}
