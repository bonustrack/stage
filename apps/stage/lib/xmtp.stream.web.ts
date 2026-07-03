
import type { DecodedMessage } from '@xmtp/browser-sdk';
import { isMetroControlBody } from './pushRegister.control';
import { getCachedXmtpClient, getOrCreateXmtpClient } from './xmtp.client.web';
import { envelopeOfXmtpMessage } from './xmtp.envelope.web';
import { activeFeedLines, registerGlobalStreamTeardown } from './xmtp.state.web';
import {
  STREAM_CONSENT_STATES, pushToFeedSlice, resyncActiveFeeds,
} from './xmtp.resync.web';
import { lineOfConv, type StreamMsg } from './xmtp.types.web';
import { reconcileOnArrival, feedLatestNs } from '../modules/messaging/feedReconcile';

export { PAGE_SIZE, syncInboxOnce } from './xmtp.resync.web';

const streamSubscribers = new Set<(m: StreamMsg) => void>();
export function subscribeAllMessages(cb: (m: StreamMsg) => void): () => void {
  streamSubscribers.add(cb);
  void ensureGlobalStream();
  return () => { streamSubscribers.delete(cb); };
}

interface StreamHandle { end: () => Promise<unknown> }

let globalStreamHandle: StreamHandle | null = null;
let globalStreamStarting = false;
let globalStreamRearmTimer: ReturnType<typeof setTimeout> | null = null;
let visibilityHandler: (() => void) | null = null;

function rearmGlobalStream(): void {
  if (globalStreamRearmTimer) return;
  globalStreamRearmTimer = setTimeout(() => {
    globalStreamRearmTimer = null;
    void ensureGlobalStream();
  }, 500);
}

function fanOutToSubscribers(convId: string | null, msg: DecodedMessage): void {
  if (streamSubscribers.size === 0) return;
  for (const cb of streamSubscribers) {
    try { cb({ convId, msg }); } catch { }
  }
}

function routeMessageToFeed(convId: string, msg: DecodedMessage): void {
  const line = lineOfConv(convId);
  const env = envelopeOfXmtpMessage(msg, line);
  if (isMetroControlBody(env.text)) return;
  const prevLatestNs = activeFeedLines.has(line) ? feedLatestNs(line) : 0;
  pushToFeedSlice(line, env);
  if (activeFeedLines.has(line)) {
    void reconcileOnArrival(line, prevLatestNs, Number(msg.sentAtNs), env.id);
  }
  if (activeFeedLines.size > 0 && !activeFeedLines.has(line)) void resyncActiveFeeds();
}

function handleStreamMessage(msg: DecodedMessage | undefined): void {
  if (!msg) return;
  const convId = msg.conversationId || null;
  fanOutToSubscribers(convId, msg);
  if (!convId) {
    if (activeFeedLines.size > 0) void resyncActiveFeeds();
    return;
  }
  routeMessageToFeed(convId, msg);
}

function onGlobalStreamClose(): void {
  globalStreamHandle = null;
  void resyncActiveFeeds();
  rearmGlobalStream();
}

function attachVisibilityResync(): void {
  if (visibilityHandler) return;
  visibilityHandler = (): void => {
    if (document.visibilityState !== 'visible') return;
    void resyncActiveFeeds();
    if (!globalStreamHandle) void ensureGlobalStream();
  };
  document.addEventListener('visibilitychange', visibilityHandler);
}

export async function ensureGlobalStream(): Promise<void> {
  if (globalStreamHandle || globalStreamStarting) return;
  globalStreamStarting = true;
  try {
    const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
    globalStreamHandle = await client.conversations.streamAllMessages({
      onValue: handleStreamMessage,
      onError: () => undefined,
      onFail: onGlobalStreamClose,
      consentStates: STREAM_CONSENT_STATES,
    });
    attachVisibilityResync();
  } catch { }
  finally { globalStreamStarting = false; }
}

function teardownGlobalStream(): void {
  if (globalStreamHandle) {
    const handle = globalStreamHandle;
    globalStreamHandle = null;
    void handle.end().catch(() => undefined);
  }
  if (globalStreamRearmTimer) { clearTimeout(globalStreamRearmTimer); globalStreamRearmTimer = null; }
  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler);
    visibilityHandler = null;
  }
}
registerGlobalStreamTeardown(teardownGlobalStream);
