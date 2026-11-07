import type { StreamMsg, StreamStatus } from './xmtp.types';
import { lineOfConv } from '@stage-labs/client/xmtp/line';
import { sdk } from './xmtp.sdk';
import { registerGlobalStreamTeardown } from './xmtp.state.core';
import type { MessageDeletion } from './xmtp.sdk.core';
import { foregroundWatch } from './xmtp.foreground';
import { dmRoutesReady, isImportedReplay, routeConvId } from './dmRoutes';
import { afterFirstPages } from './feed/firstPages';
import { hasOpenFeeds } from './feed/lines';
import { onArrival, onDeletion, onStreamClosed, onUnknownArrival } from './feed/arrival';
import { report, reported } from './errorPolicy';
import { accountClient, type AccountClient } from './xmtp.account';
import { isHiddenFromFeeds, reconcileHiddenConsent } from './channelVisibility';
import { subscribeHiddenChannels } from './sync/hiddenChannels';
import { subscribeAccountChange } from './accountSelection';
import { makeGlobalStream, openAccountStreams } from './xmtp.stream.core';
import { schedulePushTopicRefresh } from './pushRegister';

type StreamMessage = Parameters<Parameters<typeof sdk.streamAllMessages>[1]>[0];

interface SubscribeOptions {
  includeHidden?: boolean;
}

const streamSubscribers = new Map<(m: StreamMsg) => void, boolean>();

let lastMessageAt = 0;
let lastCloseAt = 0;

const status: StreamStatus = {
  live: () => globalStream.live(),
  lastMessageAt: () => lastMessageAt,
  lastCloseAt: () => lastCloseAt,
  ensure: () => {
    void ensureGlobalStream();
  },
};

export function subscribeAllMessages(cb: (m: StreamMsg) => void, options: SubscribeOptions = {}): () => void {
  streamSubscribers.set(cb, options.includeHidden === true);
  void ensureGlobalStream();
  return () => {
    streamSubscribers.delete(cb);
    if (streamSubscribers.size === 0 && !hasOpenFeeds()) globalStream.teardown();
  };
}

function fanOutToSubscribers(convId: string | null | undefined, msg: NonNullable<StreamMessage>): void {
  if (streamSubscribers.size === 0) return;
  const normalized = sdk.rowOf(msg);
  const hidden = isHiddenFromFeeds(convId);
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
  onArrival(line, sdk.envelopeOf(msg, line), sdk.sentNsOf(msg));
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
    onUnknownArrival();
    return;
  }
  if (!isHiddenFromFeeds(convId)) routeMessageToFeed(convId, msg);
}

function onMessageDeleted(context: AccountClient, { convId, messageId }: MessageDeletion): void {
  const line = lineOfConv(routeConvId(convId));
  void onDeletion(
    line,
    messageId,
    () => sdk.deletedEntryOf(context.client, messageId, line),
    () => context.current(),
  ).catch(reported('xmtp.deletion'));
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
    messages: () =>
      sdk.streamAllMessages(
        context.client,
        (msg) => {
          if (current()) handleStreamMessage(msg);
        },
        closed,
      ),
    preferences: (refresh) => sdk.streamPreferences(context.client, refresh, closed),
    deletions: () =>
      sdk.streamDeletions(context.client, (deletion) => {
        if (current()) onMessageDeleted(context, deletion);
      }),
    refreshPush: schedulePushTopicRefresh,
    current,
    signal,
  });
}

const globalStream = makeGlobalStream({
  prepare: prepareStream,
  current: (context: AccountClient) => context.current(),
  open: openStream,
  wanted: () => streamSubscribers.size > 0 || hasOpenFeeds(),
  live: () => {
    foregroundWatch.attach(status);
  },
  closed: () => {
    lastCloseAt = Date.now();
    onStreamClosed();
  },
  stopped: () => {
    lastMessageAt = 0;
    lastCloseAt = 0;
    foregroundWatch.detach();
  },
  report: reported('xmtp.globalStream'),
  schedule: (run, delay) => {
    const timer = setTimeout(run, delay);
    return () => {
      clearTimeout(timer);
    };
  },
});

export const ensureGlobalStream = globalStream.ensure;
registerGlobalStreamTeardown(globalStream.teardown);
subscribeHiddenChannels(() => {
  globalStream.teardown();
  globalStream.rearm();
});
subscribeAccountChange((moment) => {
  globalStream.teardown();
  if (moment === 'client') void globalStream.ensure();
});
