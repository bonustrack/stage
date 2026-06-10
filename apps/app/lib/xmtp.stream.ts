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
import { setAppForeground } from '../modules/metro-pill';
import { isMetroControlBody } from './push';
import { getCachedXmtpClient, getOrCreateXmtpClient } from './xmtp.client';
import { envelopeOfXmtpMessage } from './xmtp.messages';
import { activeFeedLines, registerGlobalStreamTeardown } from './xmtp.state';
import {
  STREAM_CONSENT_STATES, pushToFeedSlice, resyncActiveFeeds,
} from './xmtp.resync';
import { lineOfConv, type StreamMsg } from './xmtp.types';

export { PAGE_SIZE, syncInboxOnce } from './xmtp.resync';

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

let globalStreamCancel: (() => void) | null = null;
let globalStreamStarting = false;
// `number` (RN timer id): the Railgun SDK pulls @types/node into the app's type
// program, whose Timeout return type collides with the DOM lib at clear*().
let globalStreamRearmTimer: number | null = null;
let globalResyncTimer: number | null = null;
let globalAppStateSub: { remove: () => void } | null = null;

/** Re-arm the global stream after a short debounce. Used by `onClose` so a
 *  dropped native stream auto-restarts instead of silently degrading to the
 *  low-frequency resync poll. */
function rearmGlobalStream(): void {
  if (globalStreamRearmTimer) return;
  globalStreamRearmTimer = setTimeout(() => {
    globalStreamRearmTimer = null;
    void ensureGlobalStream();
  }, 500) as unknown as number;
}

/** Subscribe the one native fan-out for every conversation on this inbox. Maps
 *  each message to its metro line and routes it into the matching feedCache
 *  slice + channels-list subscribers. Re-armed via `onClose` on native drop. */
async function startStream(client: Awaited<ReturnType<typeof getOrCreateXmtpClient>>): Promise<void> {
  await client.conversations.streamAllMessages(
    async (msg) => {
      if (!msg) return;
      /** Derive the conv id TOPIC-FIRST (the `g-<hex>` group id), `conversationId`
       *  only as fallback. MUST match the channels list (HomeScreen.stream's
       *  topic-first `convIdFromTopic`) + the open feed (`lineOfConv(convId)`).
       *  ROOT CAUSE of "open feed misses messages the list got": RN
       *  `DecodedMessage.conversationId`, when present, isn't always the topic
       *  `g-<hex>` id rows/lines use — preferring it made
       *  `pushToFeedSlice(lineOfConv(id))` write a DIFFERENT feedCache key than
       *  the one the open feed subscribed under, so its slice subscription never
       *  fired (list still bumped, topic-first). */
      const convId = convIdFromTopicStr((msg as unknown as { topic?: string }).topic)
        ?? (msg as unknown as { conversationId?: string }).conversationId;
      /** Fan out the raw message to channels-list subscribers FIRST (#1) — they
       *  do their own control-DM filtering + need the raw msg for preview/sender.
       *  One decode, two consumers. */
      if (streamSubscribers.size > 0) {
        for (const cb of streamSubscribers) { try { cb({ convId: convId ?? null, msg }); } catch { /* ignore */ } }
      }
      if (!convId) {
        /** Couldn't derive a conv id from this message → can't key it into a
         *  feedCache slice. If a feed is open, resync it so the message isn't
         *  stranded until the 7s backstop (mirrors the channels-list refresh
         *  fallback on a convId miss). */
        if (activeFeedLines.size > 0) void resyncActiveFeeds();
        return;
      }
      const line = lineOfConv(convId);
      const env = envelopeOfXmtpMessage(msg, line);
      if (isMetroControlBody(env.text)) return;
      pushToFeedSlice(line, env);
      /** DESYNC GUARD (Home updates, open feed doesn't): the topic-derived
       *  `convId` here can differ from the route's convId the open feed
       *  subscribed under (`lineOfConv(routeConvId)`), so this slice write lands
       *  on a key nothing is listening to. When the pushed line isn't an active
       *  feed but SOME feed is open, resync the active feed(s) immediately via
       *  the canonical `convOfLine` handle so the open conversation shows the
       *  message live instead of only after reopen/refresh. */
      if (activeFeedLines.size > 0 && !activeFeedLines.has(line)) void resyncActiveFeeds();
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
    if (!globalResyncTimer) globalResyncTimer = setInterval(() => { void resyncActiveFeeds(); }, 7_000) as unknown as number;
    /** FOREGROUND FLAG: the app is foregrounded right now (the stream just
     *  started from a live mount), so tell native to skip its generic push card —
     *  the rich JS local notif (presentInboundNotification, fired from the
     *  channels-list stream handler) is the single foreground card. Cleared on
     *  background below so cold/background falls back to the generic card. */
    setAppForeground(AppState.currentState === 'active');
    if (!globalAppStateSub) {
      globalAppStateSub = AppState.addEventListener('change', (state) => {
        /** Mirror the active-conv plumbing: foreground ⟺ JS posts rich cards +
         *  native suppresses its generic one; background ⟺ native generic card. */
        setAppForeground(state === 'active');
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
  /** Clear the foreground flag so a torn-down (account-switch) stream doesn't
   *  leave native thinking the app is foreground and suppressing generic cards. */
  setAppForeground(false);
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
