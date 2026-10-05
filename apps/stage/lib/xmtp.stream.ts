import { isControlBody, type StreamMsg, type StreamStatus } from './xmtp.types';
import { lineOfConv } from '@stage-labs/client/xmtp/line';
import { sdk } from './xmtp.sdk';
import { activeFeedLines, feedCache, isHiddenConv, registerGlobalStreamTeardown } from './xmtp.state.core';
import type { MessageDeletion } from './xmtp.sdk.core';
import { mergeIntoFeed, resyncActiveFeeds } from './xmtp.resync';
import { foregroundWatch } from './xmtp.foreground';
import { dmRoutesReady, isImportedReplay, routeConvId } from './dmRoutes';
import { afterFirstPages } from './feedLines';
import { reconcileOnArrival, feedLatestNs } from '../modules/messaging/feedQuery';
import { report, reported } from './errorPolicy';
import { accountClient } from './xmtp.account';
import { reconcileHiddenConsent } from './channelVisibility';
import { isChannelHidden, subscribeHiddenChannels } from './hiddenChannels';

type StreamMessage = Parameters<Parameters<typeof sdk.streamAllMessages>[1]>[0];

interface SubscribeOptions { includeHidden?: boolean }

const REARM_DELAY_MS = 500;
const RETRY_BASE_MS = 5_000;
const RETRY_MAX_MS = 60_000;

const streamSubscribers = new Map<(m: StreamMsg) => void, boolean>();

let cancelStream: (() => void) | null = null;
let cancelDeletions: (() => void) | null = null;
let starting = false;
let generation = 0;
let rearmTimer: ReturnType<typeof setTimeout> | null = null;
let startFailures = 0;
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

function rearmGlobalStream(delayMs = REARM_DELAY_MS): void {
  if (rearmTimer) return;
  rearmTimer = setTimeout(() => {
    rearmTimer = null;
    void ensureGlobalStream();
  }, delayMs);
}

function retryAfterStartFailure(err: unknown): void {
  report('xmtp.globalStream', err);
  if (streamSubscribers.size === 0) return;
  startFailures += 1;
  rearmGlobalStream(Math.min(RETRY_BASE_MS * 2 ** (startFailures - 1), RETRY_MAX_MS));
}

function fanOutToSubscribers(convId: string | null | undefined, msg: NonNullable<StreamMessage>): void {
  if (streamSubscribers.size === 0) return;
  const normalized = sdk.rowOf(msg);
  const hidden = isHiddenConv(convId) || isChannelHidden(convId);
  for (const [cb, includeHidden] of streamSubscribers) {
    if (hidden && !includeHidden) continue;
    try {
      cb({ convId: convId ?? null, msg: normalized });
    } catch (err) {
      report('xmtp.streamSubscriber', err);
    }
  }
}

function routeMessageToFeed(convId: string, msg: NonNullable<StreamMessage>): void {
  const line = lineOfConv(convId);
  const env = sdk.envelopeOf(msg, line);
  if (isControlBody(env.text)) return;
  const prevLatestNs = activeFeedLines.has(line) ? feedLatestNs(line) : 0;
  mergeIntoFeed(line, [env]);
  if (activeFeedLines.has(line)) {
    void reconcileOnArrival(line, prevLatestNs, sdk.sentNsOf(msg), env.id);
  }
  if (activeFeedLines.size > 0 && !activeFeedLines.has(line)) void resyncActiveFeeds();
}

function routedConvId(msg: NonNullable<StreamMessage>): string | null | undefined {
  const convId = sdk.convIdOf(msg);
  return convId ? routeConvId(convId) : convId;
}

function handleStreamMessage(msg: StreamMessage): void {
  if (!msg) return;
  lastMessageAt = Date.now();
  if (isImportedReplay(sdk.sentNsOf(msg))) return;
  const convId = routedConvId(msg);
  fanOutToSubscribers(convId, msg);
  if (!convId) {
    if (activeFeedLines.size > 0) void resyncActiveFeeds();
    return;
  }
  if (!isHiddenConv(convId) && !isChannelHidden(convId)) routeMessageToFeed(convId, msg);
}

async function applyDeletion(line: string, messageId: string): Promise<void> {
  const entry = await sdk.deletedEntryOf(await sdk.client(), messageId, line);
  if (entry) mergeIntoFeed(line, [entry]);
  else if (activeFeedLines.has(line)) await resyncActiveFeeds();
}

function onMessageDeleted({ convId, messageId }: MessageDeletion): void {
  const line = lineOfConv(routeConvId(convId));
  if (!feedCache.get(line)?.some(e => e.id === messageId)) return;
  void applyDeletion(line, messageId).catch(reported('xmtp.deletion'));
}

function onGlobalStreamClose(): void {
  cancelStream = null;
  if (cancelDeletions) { cancelDeletions(); cancelDeletions = null; }
  lastCloseAt = Date.now();
  void resyncActiveFeeds();
  rearmGlobalStream();
}

export async function ensureGlobalStream(): Promise<void> {
  if (cancelStream || starting) return;
  starting = true;
  const startedIn = generation;
  try {
    const context = await accountClient();
    const { client } = context;
    await afterFirstPages();
    await dmRoutesReady().catch(reported('xmtp.dmRoutes'));
    await reconcileHiddenConsent(context);
    context.assertCurrent();
    const cancel = await sdk.streamAllMessages(client, handleStreamMessage, onGlobalStreamClose);
    if (startedIn !== generation) { cancel(); rearmGlobalStream(); return; }
    cancelStream = cancel;
    cancelDeletions ??= sdk.streamDeletions(client, onMessageDeleted);
    startFailures = 0;
    foregroundWatch.attach(status);
  } catch (err) {
    retryAfterStartFailure(err);
  } finally {
    starting = false;
  }
}

function teardownGlobalStream(): void {
  generation += 1;
  if (cancelStream) { cancelStream(); cancelStream = null; }
  if (cancelDeletions) { cancelDeletions(); cancelDeletions = null; }
  if (rearmTimer) { clearTimeout(rearmTimer); rearmTimer = null; }
  lastMessageAt = 0; lastCloseAt = 0; startFailures = 0;
  foregroundWatch.detach();
}
registerGlobalStreamTeardown(teardownGlobalStream);
subscribeHiddenChannels(() => { teardownGlobalStream(); rearmGlobalStream(); });
