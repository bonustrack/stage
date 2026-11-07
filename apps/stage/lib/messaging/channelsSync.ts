import { useEffect } from 'react';
import { AppState } from 'react-native';
import { makeValue } from '../storeCore';
import { useAccountEpoch } from '../accountEpoch';
import { syncPreferences, xmtpClient } from '../xmtp.client';
import { sdk } from '../xmtp.sdk';
import { NoAccountError } from '../accountSelection';
import { getXmtpBootstrapPhase, isActiveConv } from '../xmtp.state.core';
import { isSyncConv } from '../sync/group';
import { primeConversationMembers } from '../xmtp.identity';
import { subscribeAllMessages } from '../xmtp.stream';
import {
  listVisibleConversations,
  syncConversationsFromNetwork,
  streamNewConversations,
  streamConvConsent,
  getConvConsentState,
  createdBySelf,
  groupAccessOf,
  isFreshOwnGroup,
} from '../xmtp.conv';
import { hydrateCachedRows, setCachedRows } from '../channelsCache';
import { summarizeConversation } from './conversation';
import { shortAddress } from '@stage-labs/client/identity/format';
import { afterFirstPages } from '../feed/firstPages';
import { getPeerName } from '../peerProfiles';
import { hydratePeerProfiles } from '../peerProfileCache';
import { perfLog, perfTime } from '../perf';
import { dmIdsByPeer } from '@stage-labs/client/xmtp/dmRoutes';
import { uniqueBy } from '@stage-labs/client/collections';
import { hasHomeRows, homeRows, updateHomeRows, type HomeRow as Row } from './homeRows';
import { mergePaintedRows, visibleRowsDiff } from './channelsSync.model';
import { schedulePushTopicRefresh } from '../pushRegister';
import { report, recover, attempt } from '../errorPolicy';
import { presentInboundNotification } from '../pushNotify';
import { rowPreviewOf } from '@stage-labs/client/xmtp/contentTypes';
import { applyInbound } from '@stage-labs/client/xmtp/channelsCache';
import { ROW_PREVIEW_MAX_CHARS, type StreamedMessage } from '@stage-labs/client/xmtp/summarizeRow';
import { arrivalEffect, countsAsUnread, isRowCandidate, revivesRow } from '@stage-labs/client/xmtp/visibility';
import { isChannelHidden, loadHiddenChannels, subscribeHiddenChannels } from '../sync/hiddenChannels';
import { getActiveAccount } from '../accounts';

function makeSeenOnce(limit: number): (id: string) => boolean {
  const seen = new Set<string>();
  return (id) => {
    if (seen.has(id)) return true;
    seen.add(id);
    if (seen.size > limit) {
      const oldest = seen.values().next().value;
      if (oldest !== undefined) seen.delete(oldest);
    }
    return false;
  };
}

const alreadyNotified = makeSeenOnce(200);
const alreadyCounted = makeSeenOnce(2000);

interface NotifyCtx {
  title: string;
  senderAddr: string | null;
  isGroup: boolean;
  fromSelf: boolean;
}

interface MsgHandlerDeps {
  isCancelled: () => boolean;
  refresh: () => Promise<void>;
}

function makeMissRefresher(isCancelled: () => boolean, refresh: () => Promise<void>) {
  let missTimer: ReturnType<typeof setTimeout> | null = null;
  let refreshInFlight = false;

  const runRefresh = (): void => {
    if (refreshInFlight) {
      armFullRefresh();
      return;
    }
    refreshInFlight = true;
    void refresh().finally(() => {
      refreshInFlight = false;
    });
  };
  function armFullRefresh(): void {
    if (missTimer) clearTimeout(missTimer);
    missTimer = setTimeout(() => {
      missTimer = null;
      if (!isCancelled()) runRefresh();
    }, 1_000);
  }

  return (convId: string | null): void => {
    void (async (): Promise<void> => {
      if (convId && (await getConvConsentState(convId).catch(recover('home.streamConsent', null))) === 'denied') return;
      if (!isCancelled()) armFullRefresh();
    })();
  };
}

function makeMsgStreamHandler({ isCancelled, refresh }: MsgHandlerDeps) {
  const onMiss = makeMissRefresher(isCancelled, refresh);
  return ({ convId: streamConvId, msg }: { convId: string | null; msg: StreamedMessage | null }): void => {
    if (isCancelled() || !msg || isChannelHidden(streamConvId)) return;
    const effect = arrivalEffect(msg);
    if (effect === 'refresh') onMiss(streamConvId);
    if (effect !== 'row') return;
    const lastTs = msg.sentNs ? Math.floor(msg.sentNs / 1_000_000) : Date.now();
    const lastPreview = rowPreviewOf(msg).slice(0, ROW_PREVIEW_MAX_CHARS);

    const result = applyToRows(streamConvId, msg, lastTs, lastPreview);
    if (result.needsRefresh) onMiss(streamConvId);
    maybeNotify(result.notify, streamConvId, msg.id, lastPreview);
  };
}

function applyToRows(
  msgConvId: string | null,
  msg: StreamedMessage,
  lastTs: number,
  lastPreview: string,
): { needsRefresh: boolean; notify: NotifyCtx | null } {
  const unchanged = { needsRefresh: false, notify: null };
  const prev = homeRows();
  if (!prev) return unchanged;
  const target = prev.find((r) => r.convId === msgConvId);
  const dm = target?.peerAddress != null;
  if (target !== undefined && !isRowCandidate(msg, dm)) return unchanged;
  const result = applyInbound(
    prev,
    {
      convId: msgConvId,
      senderInboxId: msg.senderInboxId,
      sentNs: msg.sentNs,
      lastTs,
      lastPreview,
      countsAsUnread: countsAsUnread(msg) && !alreadyCounted(msg.id),
    },
    (cur) => ({
      avatarAddress: cur.peerAddress ?? cur.avatarAddress,
      lastSenderAddress: cur.inboxToAddr[msg.senderInboxId] ?? null,
      lastFromSelf: msg.senderInboxId === cur.selfInboxId,
      lastBubbleTs: revivesRow(msg, dm) ? lastTs : cur.lastBubbleTs,
    }),
  );
  if (result === null) return { needsRefresh: true, notify: null };
  setCachedRows(result.next);
  const { current } = result;
  return {
    needsRefresh: false,
    notify: {
      title: current.title,
      senderAddr: current.inboxToAddr[msg.senderInboxId] ?? null,
      isGroup: current.peerAddress == null,
      fromSelf: msg.senderInboxId === current.selfInboxId,
    },
  };
}

function notifyTitleBody(n: NotifyCtx, preview: string): { title: string; body: string } {
  const senderName = getPeerName(n.senderAddr) ?? (n.senderAddr ? shortAddress(n.senderAddr) : 'New message');
  if (n.isGroup) return { title: n.title, body: `${senderName}: ${preview}` };
  return { title: getPeerName(n.senderAddr) ?? n.title, body: preview };
}

function maybeNotify(n: NotifyCtx | null, convId: string | null, msgId: string | undefined, preview: string): void {
  if (!n || n.fromSelf || !convId || isActiveConv(convId)) return;
  if (msgId && alreadyNotified(msgId)) return;
  const { title, body } = notifyTitleBody(n, preview);
  void presentInboundNotification({ title, body, convId, messageId: msgId });
}

const INIT_TIMEOUT_MS = 30_000;

type Conv = Awaited<ReturnType<typeof listVisibleConversations>>[number];

async function summarize(conv: Conv, selfInboxId: string, alreadySynced = false): Promise<Row> {
  return { ...(await summarizeConversation(conv, selfInboxId, alreadySynced, dmIdsByPeer(homeRows() ?? []))) };
}

const INIT_TIMEOUT_MESSAGE = 'XMTP failed to initialise (timed out). Tap Reset below to wipe the local identity and start fresh.';

const syncError = makeValue('');

export const useChannelsSyncError = syncError.use;

interface SyncRun {
  cancelled: boolean;
  initTimer?: ReturnType<typeof setTimeout>;
  cancelConvStream: (() => void) | null;
  cancelMsgStream: (() => void) | null;
  cancelConsentStream: (() => void) | null;
  reconcileVisibility?: () => Promise<void>;
  appStateSub: { remove: () => void } | null;
}

interface Refreshers {
  refresh: () => Promise<void>;
  refreshThrottled: () => Promise<void>;
  reconcile: () => Promise<void>;
}

function makeRefreshers(client: Awaited<ReturnType<typeof xmtpClient>>, selfInboxId: string, run: SyncRun): Refreshers {
  let lastRefreshAt = 0;
  const THROTTLE_MS = 30_000;
  const paintFrom = async (convs: Conv[]): Promise<boolean> => {
    const beforeIds = (homeRows() ?? []).map((r) => r.convId);
    await primeConversationMembers(client, convs);
    const previous = new Map((homeRows() ?? []).map((r) => [r.convId, r]));
    const summarized = (
      await Promise.all(convs.map((c) => summarize(c, selfInboxId, true).catch(() => previous.get(c.id) ?? null)))
    ).filter((r): r is Row => r !== null);
    if (run.cancelled) return false;
    updateHomeRows((prev) =>
      mergePaintedRows(
        beforeIds,
        prev,
        uniqueBy(summarized, (row) => row.convId),
      ),
    );
    lastRefreshAt = Date.now();
    clearTimeout(run.initTimer);
    return true;
  };
  const refresh = async (): Promise<void> => {
    if (run.cancelled) return;
    try {
      if (sdk.storeChangesInBackground || !hasHomeRows()) {
        const local = await perfTime('channels.listLocal', listVisibleConversations);
        perfLog('channels.localCount', { count: local.length });
        if (local.length > 0) await perfTime('channels.paintLocal', () => paintFrom(local));
      }
      await perfTime('channels.syncNetwork', syncConversationsFromNetwork);
      if (run.cancelled) return;
      const fresh = await listVisibleConversations();
      await perfTime('channels.paintFresh', () => paintFrom(fresh));
    } catch (err) {
      report('home.refresh', err);
    }
  };
  const refreshThrottled = async (): Promise<void> => {
    if (run.cancelled || Date.now() - lastRefreshAt < THROTTLE_MS) return;
    await refresh();
  };
  const reconcile = async (): Promise<void> => {
    try {
      const rows = homeRows();
      if (rows === null) return;
      const visible = await listVisibleConversations();
      const { added, gone } = visibleRowsDiff(
        rows.map((r) => r.convId),
        visible.map((c) => c.id),
      );
      if (added.length === 0 && gone.length === 0) return;
      const fresh = (
        await Promise.all(
          visible
            .filter((c) => added.includes(c.id))
            .map((c) => summarize(c, selfInboxId, createdBySelf(c, selfInboxId)).catch(recover<Row | null>('home.reconcile', null))),
        )
      ).filter((r): r is Row => r !== null);
      if (run.cancelled) return;
      updateHomeRows((prev) => uniqueBy([...fresh, ...(prev ?? []).filter((r) => !gone.includes(r.convId))], (row) => row.convId));
    } catch (err) {
      report('home.reconcile', err);
    }
  };
  return { refresh, refreshThrottled, reconcile };
}

async function onNewConversation(conv: Conv, selfInboxId: string, run: SyncRun): Promise<void> {
  schedulePushTopicRefresh();
  if (await isSyncConv(conv).catch(recover('home.newConversation', false))) return;
  if ((await getConvConsentState(conv.id).catch(recover('home.newConversation', null))) === 'denied') return;
  if ((await groupAccessOf(conv.id).catch(recover('home.newConversationAccess', 'waiting'))) === 'outside') return;
  const row = await summarize(conv, selfInboxId, createdBySelf(conv, selfInboxId)).catch(recover('home.newConversation', null));
  if (!row || run.cancelled) return;
  updateHomeRows((prev) => (prev ? [row, ...prev.filter((x) => x.convId !== row.convId)] : [row]));
}

function subscribeConvStream(selfInboxId: string, run: SyncRun): void {
  try {
    run.cancelConvStream = streamNewConversations((conv) => {
      if (!run.cancelled) void onNewConversation(conv, selfInboxId, run);
    });
  } catch (err) {
    report('home.convStream', err);
  }
}

async function reconcileUnlessOwnNew(convIds: string[], selfInboxId: string, reconcile: () => Promise<void>): Promise<void> {
  const own = await Promise.all(convIds.map((id) => isFreshOwnGroup(id, selfInboxId).catch(recover('home.ownConsent', false))));
  if (own.length > 0 && own.every(Boolean)) return;
  await reconcile();
}

function subscribeLiveStreams(run: SyncRun, r: Refreshers, selfInboxId: string): void {
  run.reconcileVisibility = r.reconcile;
  try {
    run.cancelMsgStream = subscribeAllMessages(makeMsgStreamHandler({ isCancelled: () => run.cancelled, refresh: r.refresh }));
  } catch (err) {
    report('home.messageStream', err);
  }
  try {
    run.cancelConsentStream = streamConvConsent((convIds) => {
      void reconcileUnlessOwnNew(convIds, selfInboxId, r.reconcile);
    });
  } catch (err) {
    report('home.consentStream', err);
  }
  run.appStateSub = AppState.addEventListener('change', (state) => {
    if (state !== 'active') return;
    void syncPreferences();
    void r.refreshThrottled();
  });
}

async function initSync(run: SyncRun): Promise<void> {
  try {
    const client = await xmtpClient();
    clearTimeout(run.initTimer);
    const selfInboxId = sdk.inboxIdOf(client);
    const r = makeRefreshers(client, selfInboxId, run);
    await hydratePeerProfiles();
    await afterFirstPages();
    await r.refresh();
    if (run.cancelled) return;
    subscribeConvStream(selfInboxId, run);
    subscribeLiveStreams(run, r, selfInboxId);
    await syncPreferences();
  } catch (e) {
    if (run.cancelled || e instanceof NoAccountError) {
      clearTimeout(run.initTimer);
      return;
    }
    if (!hasHomeRows()) syncError.set((e as Error).message);
  }
}

function armInitTimer(run: SyncRun): void {
  run.initTimer = setTimeout(() => {
    if (run.cancelled || hasHomeRows()) return;
    if (getXmtpBootstrapPhase() === 'registering') {
      armInitTimer(run);
      return;
    }
    syncError.set(INIT_TIMEOUT_MESSAGE);
  }, INIT_TIMEOUT_MS);
}

function stopRun(run: SyncRun): void {
  run.cancelled = true;
  clearTimeout(run.initTimer);
  for (const stop of [run.cancelConvStream, run.cancelMsgStream, run.cancelConsentStream]) {
    if (stop) attempt(stop, 'cleanup');
  }
  const appStateSub = run.appStateSub;
  if (appStateSub)
    attempt(() => {
      appStateSub.remove();
    }, 'cleanup');
}

function startChannelsSync(): () => void {
  syncError.set('');
  const run: SyncRun = { cancelled: false, cancelConvStream: null, cancelMsgStream: null, cancelConsentStream: null, appStateSub: null };
  armInitTimer(run);
  const removeHidden = (): void => {
    if (homeRows() !== null) updateHomeRows((rows) => rows);
  };
  const stopVisibility = subscribeHiddenChannels(() => {
    removeHidden();
    void run.reconcileVisibility?.();
  });
  void (async (): Promise<void> => {
    const account = await getActiveAccount();
    if (account) await loadHiddenChannels(account.id);
    await hydrateCachedRows();
    if (!run.cancelled) removeHidden();
  })().catch(recover('home.visibility', undefined));
  void hydratePeerProfiles();
  void initSync(run);
  return (): void => {
    stopRun(run);
    stopVisibility();
  };
}

export function useChannelsSync(active: boolean): void {
  const accountEpoch = useAccountEpoch();
  useEffect(() => (active ? startChannelsSync() : undefined), [accountEpoch, active]);
}
