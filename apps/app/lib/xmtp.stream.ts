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
 *  conv's `feedCache` slice, and pushed to that slice's subscribers.
 *
 *  DELIVERY SIGNALS (fully event-driven — NO periodic poll):
 *    1. MLS `streamAllMessages` — the live stream; re-armed via `onClose` on a
 *       native drop (backgrounding/blip).
 *    2. FCM push (`onXmtpPush` from MetroFcmService) — the reliable real-time
 *       wake. The contentless push is the ONE signal that always reaches the
 *       device when a message lands, so on it we force a `syncInboxOnce(0)` +
 *       `resyncActiveFeeds()`. This covers the stream silently dying AND
 *       foreground (the native fires it before its card-suppression returns).
 *    3. AppState 'active' resume — coarse safety net for long backgrounds where
 *       FCM may have been throttled/dropped.
 *  The old 7s `setInterval` poll was REMOVED: stream + push are the real-time
 *  signals, AppState-resume is the backstop.
 *  ─────────────────────────────────────────────────────────────────────────── */

import { AppState } from 'react-native';
import { setAppForeground, subscribeXmtpPush } from '../modules/metro-pill';
import { isMetroControlBody } from './push';
import { markBackgroundDelivered } from './pushRegister';
import { getCachedXmtpClient, getOrCreateXmtpClient } from './xmtp.client';
import { envelopeOfXmtpMessage } from './xmtp.messages';
import { activeFeedLines, registerGlobalStreamTeardown } from './xmtp.state';
import {
  STREAM_CONSENT_STATES, pushToFeedSlice, resyncActiveFeeds, syncInboxOnce,
} from './xmtp.resync';
import { lineOfConv, type StreamMsg } from './xmtp.types';
import { reconcileOnArrival, feedLatestNs } from '../modules/messaging/feedReconcile';

export { PAGE_SIZE, syncInboxOnce } from './xmtp.resync';

/** Channels-list subscribers to the SINGLE global stream (#1). index.tsx
 *  subscribes here instead of starting its own `streamAllMessages`, so each
 *  inbound is decoded once and routed to BOTH the feedCache slice (conv view)
 *  AND these subscribers (row/preview/unread bookkeeping). */
const streamSubscribers = new Set<(m: StreamMsg) => void>();
/** Subscribe to every inbound message on the single global stream; returns an unsubscribe fn. */
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
let globalAppStateSub: { remove: () => void } | null = null;
let globalPushSub: (() => void) | null = null;
/** Coalesce a burst of pushes (e.g. several messages arriving at once) into a
 *  single forced resync. */
let pushResyncTimer: number | null = null;
/** When the last FORCED (maxAge 0) push-driven inbox sync ran. Enforces a
 *  minimum spacing so a push burst can't run back-to-back 3-8s inbox syncs. */
let lastForcedPushSyncAt = 0;
/** When the live MLS stream last delivered a message (set in `startStream`).
 *  A push that arrives right after a live delivery is redundant — the stream
 *  already brought the message — so we can skip the forced inbox sync. */
let lastStreamMsgAt = 0;
/** When the global stream last closed (set in `startStream`'s onClose). While
 *  the stream is dead / re-arming a push MUST always force-sync (the point of
 *  #454: a push is the only signal that reaches a device with a dead stream). */
let lastStreamCloseAt = 0;
/** Minimum spacing between forced push-driven inbox syncs (full passes are
 *  3-8s; back-to-back ones starve the JS thread + hammer the read-rate limit). */
const MIN_FORCED_SYNC_SPACING_MS = 4_000;
/** If the live stream delivered within this window, a push is redundant. */
const STREAM_FRESH_MS = 3_000;
/** Treat the stream as "recently dead / re-arming" within this window of an
 *  onClose, so a push during the gap still force-syncs unconditionally. */
const STREAM_DEAD_GRACE_MS = 5_000;

/** Called from the live stream callback so push handling can tell whether the
 *  stream just delivered (making a subsequent push redundant). */
function noteStreamDelivery(): void { lastStreamMsgAt = Date.now(); }

/** Push-driven resync: the FCM `onXmtpPush` event is the real-time wake.
 *
 *  TRAILING-edge debounce (was leading): coalesce a push burst into ONE sync
 *  that runs ~300ms after the LAST push, so several messages landing together
 *  trigger a single pass instead of one-per-push.
 *
 *  When the timer fires we decide whether to FORCE (maxAge 0) the inbox sync:
 *    - Stream dead / re-arming (onClose fired recently OR no live cancel) →
 *      ALWAYS force. This is the #454 guarantee: a push is the only signal that
 *      reaches a device whose stream silently died, so it must resync promptly.
 *    - Stream alive AND it delivered a message within STREAM_FRESH_MS → the push
 *      is redundant (the stream already brought it); SKIP the forced sync. We
 *      still run a coalesced non-forced resync of open feeds (cheap, respects
 *      the syncInboxOnce freshness window) so nothing regresses.
 *    - Otherwise (stream alive but quiet) → force, but throttled to one forced
 *      sync per MIN_FORCED_SYNC_SPACING_MS so a burst can't run back-to-back
 *      full inbox passes. */
function onXmtpPush(): void {
  if (pushResyncTimer) clearTimeout(pushResyncTimer);
  pushResyncTimer = setTimeout(() => {
    pushResyncTimer = null;
    const now = Date.now();
    const streamDead = !globalStreamCancel
      || (now - lastStreamCloseAt) < STREAM_DEAD_GRACE_MS;
    const streamFresh = (now - lastStreamMsgAt) < STREAM_FRESH_MS;
    void (async () => {
      if (streamDead) {
        /** Stream is down — the push is the catch-up signal; always force. */
        lastForcedPushSyncAt = now;
        await syncInboxOnce(0);
        await resyncActiveFeeds();
        return;
      }
      if (streamFresh) {
        /** Live stream just delivered — push is redundant. Cheap non-forced
         *  resync only (coalesced; no extra full inbox pass). */
        await resyncActiveFeeds();
        return;
      }
      /** Stream alive but quiet — force, throttled to the min spacing. */
      if (now - lastForcedPushSyncAt >= MIN_FORCED_SYNC_SPACING_MS) {
        lastForcedPushSyncAt = now;
        await syncInboxOnce(0);
      }
      await resyncActiveFeeds();
    })();
  }, 300) as unknown as number;
}

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
    (msg): Promise<void> => {
      if (!msg) return Promise.resolve();
      /** Mark a live delivery so a push arriving right after is treated as
       *  redundant (see onXmtpPush's STREAM_FRESH_MS skip). */
      noteStreamDelivery();
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
         *  stranded until the next push/resume backstop (mirrors the channels-list refresh
         *  fallback on a convId miss). */
        if (activeFeedLines.size > 0) void resyncActiveFeeds();
        return Promise.resolve();
      }
      const line = lineOfConv(convId);
      const env = envelopeOfXmtpMessage(msg, line);
      if (isMetroControlBody(env.text)) return Promise.resolve();
      /** Capture the open feed's tail BEFORE the push so arrival-continuity can
       *  tell whether this message is the direct successor of what the feed had,
       *  or whether an earlier message is missing locally (a sentNs gap). */
      const prevLatestNs = activeFeedLines.has(line) ? feedLatestNs(line) : 0;
      pushToFeedSlice(line, env);
      /** ARRIVAL CONTINUITY: if this conv is open and the arriving message isn't
       *  contiguous with the feed's prior tail, do ONE targeted conv.sync +
       *  slice reload so the gap is filled (event-driven, no poll). */
      if (activeFeedLines.has(line)) {
        const arrivingNs = (msg as unknown as { sentNs?: number }).sentNs ?? 0;
        void reconcileOnArrival(line, prevLatestNs, arrivingNs, env.id);
      }
      /** DESYNC GUARD (Home updates, open feed doesn't): the topic-derived
       *  `convId` here can differ from the route's convId the open feed
       *  subscribed under (`lineOfConv(routeConvId)`), so this slice write lands
       *  on a key nothing is listening to. When the pushed line isn't an active
       *  feed but SOME feed is open, resync the active feed(s) immediately via
       *  the canonical `convOfLine` handle so the open conversation shows the
       *  message live instead of only after reopen/refresh. */
      if (activeFeedLines.size > 0 && !activeFeedLines.has(line)) void resyncActiveFeeds();
      return Promise.resolve();
    },
    'all',
    STREAM_CONSENT_STATES,
    () => {
      /** Native stream closed (backgrounding/blip). Drop the stale cancel,
       *  resync the active feed once to cover the gap, then re-arm. Stamp the
       *  close time so a push during the dead/re-arming window force-syncs. */
      globalStreamCancel = null;
      lastStreamCloseAt = Date.now();
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
    /** PUSH-DRIVEN RESYNC (replaces the periodic poll): subscribe once to the
     *  native `onXmtpPush` event. The contentless FCM push is the reliable
     *  real-time wake — it fires even when foregrounded / already viewing the
     *  conv (MetroFcmService emits before its card suppression), so it covers
     *  both a silently-dead stream and the live-but-missed case. */
    globalPushSub ??= subscribeXmtpPush((e) => {
      /** If the push landed while the app wasn't foregrounded, the native FCM
       *  service already posted a generic card for it (MetroFcmService skips its
       *  card only when foregrounded). Record the message id so a subsequent
       *  foreground resync doesn't ALSO post a rich local card for it. */
      if (AppState.currentState !== 'active') markBackgroundDelivered(e?.messageId);
      onXmtpPush();
    });
    /** FOREGROUND FLAG: the app is foregrounded right now (the stream just
     *  started from a live mount), so tell native to skip its generic push card —
     *  the rich JS local notif (presentInboundNotification, fired from the
     *  channels-list stream handler) is the single foreground card. Cleared on
     *  background below so cold/background falls back to the generic card. */
    setAppForeground(AppState.currentState === 'active');
    globalAppStateSub ??= AppState.addEventListener('change', (state) => {
      /** Mirror the active-conv plumbing: foreground ⟺ JS posts rich cards +
       *  native suppresses its generic one; background ⟺ native generic card. */
      setAppForeground(state === 'active');
      if (state !== 'active') return;
      void resyncActiveFeeds();
      /** Stream may have died while backgrounded (onClose nulled the cancel) —
       *  restart it in addition to the one-off resync. */
      if (!globalStreamCancel) void ensureGlobalStream();
    });
  } catch { /* stream init failed — resync backstop still covers active feeds */ }
  finally { globalStreamStarting = false; }
}

/** Tear down the global stream + backstops. Called when the active account
 *  changes so the next account starts a fresh stream against its own inbox. */
function teardownGlobalStream(): void {
  if (globalStreamCancel) { globalStreamCancel(); globalStreamCancel = null; }
  if (globalStreamRearmTimer) { clearTimeout(globalStreamRearmTimer); globalStreamRearmTimer = null; }
  if (pushResyncTimer) { clearTimeout(pushResyncTimer); pushResyncTimer = null; }
  /** Reset push/stream timing so the next account doesn't inherit stale spacing
   *  (e.g. a "stream fresh" skip keyed off the previous inbox's delivery). */
  lastForcedPushSyncAt = 0; lastStreamMsgAt = 0; lastStreamCloseAt = 0;
  if (globalPushSub) { try { globalPushSub(); } catch { /* ignore */ } globalPushSub = null; }
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
  return m?.[1] ?? null;
}
