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
import { accountClient, type AccountClient } from './xmtp.account';
import { reconcileHiddenConsent } from './channelVisibility';
import { isChannelHidden, subscribeHiddenChannels } from './hiddenChannels';
import { subscribeAccountEpoch } from './accountEpoch';
import { subscribeAccountSelection } from './accountSelection';
import { makeGlobalStream, openAccountStreams } from './xmtp.stream.core';
import { schedulePushTopicRefresh } from './pushRegister';

type StreamMessage = Parameters<Parameters<typeof sdk.streamAllMessages>[1]>[0];

interface SubscribeOptions { includeHidden?: boolean }

const streamSubscribers = new Map<(m: StreamMsg) => void, boolean>();

let lastMessageAt = 0;
let lastCloseAt = 0;

const status: StreamStatus = {
  live: () => globalStream.live(),
  lastMessageAt: () => lastMessageAt,
  lastCloseAt: () => lastCloseAt,
  ensure: () => { void ensureGlobalStream(); },
};

export function subscribeAllMessages(cb: (m: StreamMsg) => void, options: SubscribeOptions = {}): () => void {
  streamSubscribers.set(cb, options.includeHidden === true);
  void ensureGlobalStream();
  return () => {
    streamSubscribers.delete(cb);
    if (streamSubscribers.size === 0 && activeFeedLines.size === 0) globalStream.teardown();
  };
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

async function applyDeletion(context: AccountClient, line: string, messageId: string): Promise<void> {
  const generation = feedCache.generation();
  const entry = await sdk.deletedEntryOf(context.client, messageId, line);
  if (!context.current() || feedCache.generation() !== generation) return;
  if (entry) mergeIntoFeed(line, [entry]);
  else if (activeFeedLines.has(line)) await resyncActiveFeeds();
}

function onMessageDeleted(context: AccountClient, { convId, messageId }: MessageDeletion): void {
  const line = lineOfConv(routeConvId(convId));
  if (!feedCache.get(line)?.some(e => e.id === messageId)) return;
  void applyDeletion(context, line, messageId).catch(reported('xmtp.deletion'));
}

async function prepareStream(assertCurrent: () => void): Promise<AccountClient> {
  const context = await accountClient();
  assertCurrent();
  await afterFirstPages();
  assertCurrent();
  await dmRoutesReady().catch(reported('xmtp.dmRoutes'));
  assertCurrent();
  await reconcileHiddenConsent(context);
  context.assertCurrent();
  return context;
}

function openStream(context: AccountClient, current: () => boolean, closed: () => void, signal: AbortSignal): Promise<() => void> {
  return openAccountStreams({
    messages: () => sdk.streamAllMessages(context.client, msg => { if (current()) handleStreamMessage(msg); }, closed),
    preferences: refresh => sdk.streamPreferences(context.client, refresh, closed),
    deletions: () => sdk.streamDeletions(context.client, deletion => { if (current()) onMessageDeleted(context, deletion); }),
    refreshPush: schedulePushTopicRefresh,
    current, signal,
  });
}

const globalStream = makeGlobalStream({
  prepare: prepareStream,
  current: (context: AccountClient) => context.current(),
  open: openStream,
  wanted: () => streamSubscribers.size > 0 || activeFeedLines.size > 0,
  live: () => { foregroundWatch.attach(status); },
  closed: () => { lastCloseAt = Date.now(); void resyncActiveFeeds(); },
  stopped: () => { lastMessageAt = 0; lastCloseAt = 0; foregroundWatch.detach(); },
  report: reported('xmtp.globalStream'),
  schedule: (run, delay) => { const timer = setTimeout(run, delay); return () => { clearTimeout(timer); }; },
});

export const ensureGlobalStream = globalStream.ensure;
registerGlobalStreamTeardown(globalStream.teardown);
subscribeHiddenChannels(() => { globalStream.teardown(); globalStream.rearm(); });
function restartForAccount(): void { globalStream.teardown(); void globalStream.ensure(); }
subscribeAccountEpoch(restartForAccount);
subscribeAccountSelection(globalStream.teardown);
