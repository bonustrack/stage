
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

const streamSubscribers = new Set<(m: StreamMsg) => void>();
export function subscribeAllMessages(cb: (m: StreamMsg) => void): () => void {
  streamSubscribers.add(cb);
  void ensureGlobalStream();
  return () => { streamSubscribers.delete(cb); };
}

let globalStreamCancel: (() => void) | null = null;
let globalStreamStarting = false;
let globalStreamRearmTimer: number | null = null;
let globalAppStateSub: { remove: () => void } | null = null;
let globalPushSub: (() => void) | null = null;
let pushResyncTimer: number | null = null;
let lastForcedPushSyncAt = 0;
let lastStreamMsgAt = 0;
let lastStreamCloseAt = 0;
const MIN_FORCED_SYNC_SPACING_MS = 4_000;
const STREAM_FRESH_MS = 3_000;
const STREAM_DEAD_GRACE_MS = 5_000;

function noteStreamDelivery(): void { lastStreamMsgAt = Date.now(); }

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
        lastForcedPushSyncAt = now;
        await syncInboxOnce(0);
        await resyncActiveFeeds();
        return;
      }
      if (streamFresh) {
        await resyncActiveFeeds();
        return;
      }
      if (now - lastForcedPushSyncAt >= MIN_FORCED_SYNC_SPACING_MS) {
        lastForcedPushSyncAt = now;
        await syncInboxOnce(0);
      }
      await resyncActiveFeeds();
    })();
  }, 300) as unknown as number;
}

function rearmGlobalStream(): void {
  if (globalStreamRearmTimer) return;
  globalStreamRearmTimer = setTimeout(() => {
    globalStreamRearmTimer = null;
    void ensureGlobalStream();
  }, 500) as unknown as number;
}

type StreamCb = Parameters<
  Awaited<ReturnType<typeof getOrCreateXmtpClient>>['conversations']['streamAllMessages']
>[0];
type StreamCbMsg = Parameters<StreamCb>[0];

function fanOutToSubscribers(convId: string | undefined, msg: StreamCbMsg): void {
  if (streamSubscribers.size === 0) return;
  for (const cb of streamSubscribers) {
    try { cb({ convId: convId ?? null, msg }); } catch { }
  }
}

function routeMessageToFeed(convId: string, msg: StreamCbMsg): void {
  const line = lineOfConv(convId);
  const env = envelopeOfXmtpMessage(msg, line);
  if (isMetroControlBody(env.text)) return;
  const prevLatestNs = activeFeedLines.has(line) ? feedLatestNs(line) : 0;
  pushToFeedSlice(line, env);
  if (activeFeedLines.has(line)) {
    const arrivingNs = (msg as unknown as { sentNs?: number }).sentNs ?? 0;
    void reconcileOnArrival(line, prevLatestNs, arrivingNs, env.id);
  }
  if (activeFeedLines.size > 0 && !activeFeedLines.has(line)) void resyncActiveFeeds();
}

function handleStreamMessage(msg: StreamCbMsg): Promise<void> {
  if (!msg) return Promise.resolve();
  noteStreamDelivery();
  const convId = convIdFromTopicStr((msg as unknown as { topic?: string }).topic)
    ?? (msg as unknown as { conversationId?: string }).conversationId;
  fanOutToSubscribers(convId, msg);
  if (!convId) {
    if (activeFeedLines.size > 0) void resyncActiveFeeds();
    return Promise.resolve();
  }
  routeMessageToFeed(convId, msg);
  return Promise.resolve();
}

function onGlobalStreamClose(): void {
  globalStreamCancel = null;
  lastStreamCloseAt = Date.now();
  void resyncActiveFeeds();
  rearmGlobalStream();
}

async function startStream(client: Awaited<ReturnType<typeof getOrCreateXmtpClient>>): Promise<void> {
  await client.conversations.streamAllMessages(
    handleStreamMessage,
    'all',
    STREAM_CONSENT_STATES,
    onGlobalStreamClose,
  );
}

export async function ensureGlobalStream(): Promise<void> {
  if (globalStreamCancel || globalStreamStarting) return;
  globalStreamStarting = true;
  try {
    const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
    await startStream(client);
    globalStreamCancel = () => {
      try { client.conversations.cancelStreamAllMessages(); } catch { }
    };
    globalPushSub ??= subscribeXmtpPush((e) => {
      if (AppState.currentState !== 'active') markBackgroundDelivered(e?.messageId);
      onXmtpPush();
    });
    setAppForeground(AppState.currentState === 'active');
    globalAppStateSub ??= AppState.addEventListener('change', (state) => {
      setAppForeground(state === 'active');
      if (state !== 'active') return;
      void resyncActiveFeeds();
      if (!globalStreamCancel) void ensureGlobalStream();
    });
  } catch { }
  finally { globalStreamStarting = false; }
}

function teardownGlobalStream(): void {
  if (globalStreamCancel) { globalStreamCancel(); globalStreamCancel = null; }
  if (globalStreamRearmTimer) { clearTimeout(globalStreamRearmTimer); globalStreamRearmTimer = null; }
  if (pushResyncTimer) { clearTimeout(pushResyncTimer); pushResyncTimer = null; }
  lastForcedPushSyncAt = 0; lastStreamMsgAt = 0; lastStreamCloseAt = 0;
  if (globalPushSub) { try { globalPushSub(); } catch { } globalPushSub = null; }
  if (globalAppStateSub) { try { globalAppStateSub.remove(); } catch { } globalAppStateSub = null; }
  setAppForeground(false);
}
registerGlobalStreamTeardown(teardownGlobalStream);

function convIdFromTopicStr(topic: string | undefined): string | null {
  if (!topic) return null;
  const m = /\/g-([0-9a-fA-F]+)\//.exec(topic);
  return m?.[1] ?? null;
}
