import { isControlBody, lineOfConv, type StreamMsg, type StreamStatus } from './xmtp.types';
import { sdk } from './xmtp.sdk';
import { activeFeedLines, registerGlobalStreamTeardown } from './xmtp.state.core';
import { pushToFeedSlice, resyncActiveFeeds } from './xmtp.resync';
import { foregroundWatch } from './xmtp.foreground';
import { isHiddenConv } from './readSyncRegistry';
import { reconcileOnArrival, feedLatestNs } from '../modules/messaging/feedReconcile';

type StreamMessage = Parameters<Parameters<typeof sdk.streamAllMessages>[1]>[0];

interface SubscribeOptions { includeHidden?: boolean }

const REARM_DELAY_MS = 500;

const streamSubscribers = new Map<(m: StreamMsg) => void, boolean>();

let cancelStream: (() => void) | null = null;
let starting = false;
let generation = 0;
let rearmTimer: ReturnType<typeof setTimeout> | null = null;
let lastMessageAt = 0;
let lastCloseAt = 0;

const status: StreamStatus = {
  live: () => cancelStream !== null,
  lastMessageAt: () => lastMessageAt,
  lastCloseAt: () => lastCloseAt,
  ensure: () => { void ensureGlobalStream(); },
};

export function subscribeAllMessages(cb: (m: StreamMsg) => void, options: SubscribeOptions = {}): () => void {
  streamSubscribers.set(cb, options.includeHidden === true);
  void ensureGlobalStream();
  return () => { streamSubscribers.delete(cb); };
}

function rearmGlobalStream(): void {
  if (rearmTimer) return;
  rearmTimer = setTimeout(() => {
    rearmTimer = null;
    void ensureGlobalStream();
  }, REARM_DELAY_MS);
}

function fanOutToSubscribers(convId: string | null | undefined, msg: NonNullable<StreamMessage>): void {
  if (streamSubscribers.size === 0) return;
  const normalized = sdk.rowOf(msg);
  const hidden = isHiddenConv(convId);
  for (const [cb, includeHidden] of streamSubscribers) {
    if (hidden && !includeHidden) continue;
    try { cb({ convId: convId ?? null, msg: normalized }); } catch { }
  }
}

function routeMessageToFeed(convId: string, msg: NonNullable<StreamMessage>): void {
  const line = lineOfConv(convId);
  const env = sdk.envelopeOf(msg, line);
  if (isControlBody(env.text)) return;
  const prevLatestNs = activeFeedLines.has(line) ? feedLatestNs(line) : 0;
  pushToFeedSlice(line, env);
  if (activeFeedLines.has(line)) {
    void reconcileOnArrival(line, prevLatestNs, sdk.sentNsOf(msg), env.id);
  }
  if (activeFeedLines.size > 0 && !activeFeedLines.has(line)) void resyncActiveFeeds();
}

function handleStreamMessage(msg: StreamMessage): void {
  if (!msg) return;
  lastMessageAt = Date.now();
  const convId = sdk.convIdOf(msg);
  fanOutToSubscribers(convId, msg);
  if (!convId) {
    if (activeFeedLines.size > 0) void resyncActiveFeeds();
    return;
  }
  if (!isHiddenConv(convId)) routeMessageToFeed(convId, msg);
}

function onGlobalStreamClose(): void {
  cancelStream = null;
  lastCloseAt = Date.now();
  void resyncActiveFeeds();
  rearmGlobalStream();
}

export async function ensureGlobalStream(): Promise<void> {
  if (cancelStream || starting) return;
  starting = true;
  const startedIn = generation;
  try {
    const client = await sdk.client();
    const cancel = await sdk.streamAllMessages(client, handleStreamMessage, onGlobalStreamClose);
    if (startedIn !== generation) { cancel(); return; }
    cancelStream = cancel;
    foregroundWatch.attach(status);
  } catch { }
  finally { starting = false; }
}

function teardownGlobalStream(): void {
  generation += 1;
  if (cancelStream) { cancelStream(); cancelStream = null; }
  if (rearmTimer) { clearTimeout(rearmTimer); rearmTimer = null; }
  lastMessageAt = 0; lastCloseAt = 0;
  foregroundWatch.detach();
}
registerGlobalStreamTeardown(teardownGlobalStream);
