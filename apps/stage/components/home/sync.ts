import { useEffect, type Dispatch, type SetStateAction } from 'react';
import { AppState, Platform } from 'react-native';
import { getOrCreateXmtpClient, syncPreferences } from '../../lib/xmtp.client';
import { NoAccountError } from '../../lib/xmtp.client.core';
import { getXmtpBootstrapPhase, isActiveConv, registerHiddenConv } from '../../lib/xmtp.state.core';
import { primeConversationMembers } from '../../lib/xmtp.identity';
import { subscribeAllMessages } from '../../lib/xmtp.stream';
import {
  listVisibleConversations, syncConversationsFromNetwork, streamNewConversations, streamConvConsent,
  conversationIsSyncGroup, getConvConsentState, createdBySelf,
} from '../../lib/xmtp.conv';
import { hydrateCachedRows, setCachedRows } from '../../lib/channelsCache';
import { summarizeConversation } from '../../modules/messaging/conversation';
import { isControlBody } from '../../lib/xmtp.types';
import { shortAddress } from '@stage-labs/client/identity/format';
import { afterFirstPages } from '../../lib/feedLines';
import { hydratePeerProfiles, getPeerName } from '../../lib/peerProfiles';
import { perfLog, perfTime } from '../../lib/perf';
import type { Conversation } from '@xmtp/react-native-sdk';
import { dmIdsByPeer, uniqueByConvId } from '@stage-labs/client/xmtp/dmRoutes';
import { homeRows, updateHomeRows } from './state';
import { mergePaintedRows, visibleRowsDiff, type Row } from './model';
import { schedulePushTopicRefresh } from '../../lib/pushRegister';
import { report, recover, attempt } from '../../lib/errorPolicy';
import { presentInboundNotification } from '../../lib/pushNotify';
import { isGroupUpdateTypeId, previewOfXmtpContent } from '@stage-labs/client/xmtp/humanize';
import { applyInbound } from '@stage-labs/client/xmtp/channelsCache';
import { ROW_PREVIEW_MAX_CHARS, type StreamedMessage } from '@stage-labs/client/xmtp/summarizeRow';
import { revivesClearedChat } from '@stage-labs/client/xmtp/readState';
import { isDeleteRequestType } from '@stage-labs/client/xmtp/deleteMessage';
import { isCallSignalType } from '@stage-labs/client/xmtp/call';
import { isChannelHidden, loadHiddenChannels, subscribeHiddenChannels } from '../../lib/hiddenChannels';
import { getActiveAccount } from '../../lib/accounts';

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
  let missTimer: number | null = null;
  let refreshInFlight = false;

  const runRefresh = (): void => {
    if (refreshInFlight) { armFullRefresh(); return; }
    refreshInFlight = true;
    void refresh().finally(() => { refreshInFlight = false; });
  };
  function armFullRefresh(): void {
    if (missTimer) clearTimeout(missTimer);
    missTimer = setTimeout(() => {
      missTimer = null;
      if (!isCancelled()) runRefresh();
    }, 1_000) as unknown as number;
  }

  return (convId: string | null): void => {
    void (async (): Promise<void> => {
      if (convId && (await getConvConsentState(convId).catch(recover('home.streamConsent', null))) === 'denied') return;
      if (!isCancelled()) armFullRefresh();
    })();
  };
}

function rowPreviewOf(msg: StreamedMessage): string {
  try { return previewOfXmtpContent(msg.content, msg.contentTypeId); }
  catch { return `[${msg.contentTypeId ?? 'unknown'}]`; }
}

function makeMsgStreamHandler({ isCancelled, refresh }: MsgHandlerDeps) {
  const onMiss = makeMissRefresher(isCancelled, refresh);
  return ({ convId: streamConvId, msg }: { convId: string | null; msg: StreamedMessage | null }): void => {
    if (isCancelled() || !msg || isCallSignalType(msg.contentTypeId) || isChannelHidden(streamConvId)) return;
    if (isDeleteRequestType(msg.contentTypeId)) { onMiss(streamConvId); return; }
    const decoded = msg.content;
    const preview = rowPreviewOf(msg);
    if (typeof decoded === 'string' && isControlBody(decoded)) return;
    const lastTs = msg.sentNs ? Math.floor(msg.sentNs / 1_000_000) : Date.now();
    const lastPreview = preview.slice(0, ROW_PREVIEW_MAX_CHARS);

    const result = applyToRows(streamConvId, msg, lastTs, lastPreview);
    if (result.needsRefresh) onMiss(streamConvId);
    maybeNotify(result.notify, streamConvId, msg.id, lastPreview);
  };
}

function applyToRows(
  msgConvId: string | null, msg: StreamedMessage, lastTs: number, lastPreview: string,
): { needsRefresh: boolean; notify: NotifyCtx | null } {
  const unchanged = { needsRefresh: false, notify: null };
  const prev = homeRows();
  if (!prev) return unchanged;
  const target = prev.find(r => r.convId === msgConvId);
  if (target?.peerAddress != null && isGroupUpdateTypeId(msg.contentTypeId)) return unchanged;
  const result = applyInbound(
    prev,
    {
      convId: msgConvId, senderInboxId: msg.senderInboxId, sentNs: msg.sentNs, lastTs, lastPreview,
      countsAsUnread: !isGroupUpdateTypeId(msg.contentTypeId) && !alreadyCounted(msg.id),
    },
    cur => ({
      avatarAddress: cur.peerAddress ?? cur.avatarAddress,
      lastSenderAddress: cur.inboxToAddr[msg.senderInboxId] ?? null,
      lastFromSelf: msg.senderInboxId === cur.selfInboxId,
      lastBubbleTs: revivesClearedChat(msg.contentTypeId) ? lastTs : cur.lastBubbleTs,
    }),
  );
  if (result === null) return { needsRefresh: true, notify: null };
  setCachedRows(result.next);
  const { current } = result;
  return {
    needsRefresh: false,
    notify: {
      title: current.title, senderAddr: current.inboxToAddr[msg.senderInboxId] ?? null,
      isGroup: current.peerAddress == null, fromSelf: msg.senderInboxId === current.selfInboxId,
    },
  };
}

function notifyTitleBody(n: NotifyCtx, preview: string): { title: string; body: string } {
  const senderName = getPeerName(n.senderAddr)
    ?? (n.senderAddr ? shortAddress(n.senderAddr) : 'New message');
  if (n.isGroup) return { title: n.title, body: `${senderName}: ${preview}` };
  return { title: getPeerName(n.senderAddr) ?? n.title, body: preview };
}

function shouldSkipNotify(n: NotifyCtx | null, convId: string | null, msgId: string | undefined): n is null {
  if (!n || n.fromSelf || !convId || isActiveConv(convId)) return true;
  if (msgId && alreadyNotified(msgId)) return true;
  return false;
}

function maybeNotify(
  n: NotifyCtx | null, convId: string | null, msgId: string | undefined, preview: string,
): void {
  if (shouldSkipNotify(n, convId, msgId) || !n || !convId) return;
  const { title, body } = notifyTitleBody(n, preview);
  void presentInboundNotification({ title, body, convId, messageId: msgId });
}

const INIT_TIMEOUT_MS = 30_000;

async function summarize(conv: Conversation, selfInboxId: string, alreadySynced = false): Promise<Row> {
  return { ...await summarizeConversation(conv, selfInboxId, alreadySynced, dmIdsByPeer(homeRows() ?? [])) };
}

interface SyncArgs {
  accountEpoch: number;
  setError: Dispatch<SetStateAction<string>>;
}

function hasHomeRows(): boolean {
  return (homeRows()?.length ?? 0) > 0;
}

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

function makeRefreshers(
  client: Awaited<ReturnType<typeof getOrCreateXmtpClient>>, selfInboxId: string,
  run: SyncRun,
): Refreshers {
  let lastRefreshAt = 0;
  const THROTTLE_MS = 30_000;
  const paintFrom = async (convs: Conversation[]): Promise<boolean> => {
    const beforeIds = (homeRows() ?? []).map(r => r.convId);
    await primeConversationMembers(client, convs);
    const previous = new Map((homeRows() ?? []).map(r => [r.convId, r]));
    const summarized = (await Promise.all(
      convs.map(c => summarize(c, selfInboxId, true).catch(() => previous.get(c.id) ?? null)),
    )).filter((r): r is Row => r !== null);
    if (run.cancelled) return false;
    updateHomeRows(prev => mergePaintedRows(beforeIds, prev, uniqueByConvId(summarized)));
    lastRefreshAt = Date.now();
    clearTimeout(run.initTimer);
    return true;
  };
  const refresh = async (): Promise<void> => {
    if (run.cancelled) return;
    try {
      if (!(Platform.OS === 'web' && hasHomeRows())) {
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
      const { added, gone } = visibleRowsDiff(rows.map(r => r.convId), visible.map(c => c.id));
      if (added.length === 0 && gone.length === 0) return;
      const fresh = (await Promise.all(visible.filter(c => added.includes(c.id))
        .map(c => summarize(c, selfInboxId, createdBySelf(c, selfInboxId)).catch(recover<Row | null>('home.reconcile', null)))))
        .filter((r): r is Row => r !== null);
      if (run.cancelled) return;
      updateHomeRows(prev => uniqueByConvId([...fresh, ...(prev ?? []).filter(r => !gone.includes(r.convId))]));
    } catch (err) {
      report('home.reconcile', err);
    }
  };
  return { refresh, refreshThrottled, reconcile };
}

async function onNewConversation(conv: Conversation, selfInboxId: string, run: SyncRun): Promise<void> {
  schedulePushTopicRefresh();
  if (await conversationIsSyncGroup(conv).catch(recover('home.newConversation', false))) { registerHiddenConv(conv.id); return; }
  if ((await getConvConsentState(conv.id).catch(recover('home.newConversation', null))) === 'denied') return;
  const row = await summarize(conv, selfInboxId, createdBySelf(conv, selfInboxId)).catch(recover('home.newConversation', null));
  if (!row || run.cancelled) return;
  updateHomeRows(prev => (prev ? [row, ...prev.filter(x => x.convId !== row.convId)] : [row]));
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

function subscribeLiveStreams(run: SyncRun, r: Refreshers): void {
  run.reconcileVisibility = r.reconcile;
  try {
    run.cancelMsgStream = subscribeAllMessages(makeMsgStreamHandler({
      isCancelled: () => run.cancelled, refresh: r.refresh,
    }));
  } catch (err) {
    report('home.messageStream', err);
  }
  try {
    run.cancelConsentStream = streamConvConsent(() => { void r.reconcile(); });
  } catch (err) {
    report('home.consentStream', err);
  }
  run.appStateSub = AppState.addEventListener('change', (state) => {
    if (state !== 'active') return;
    void syncPreferences();
    void r.refreshThrottled();
  });
}

async function initSync(run: SyncRun, args: SyncArgs): Promise<void> {
  try {
    const client = await getOrCreateXmtpClient('production');
    clearTimeout(run.initTimer);
    const selfInboxId = client.inboxId;
    const r = makeRefreshers(client, selfInboxId, run);
    await hydratePeerProfiles();
    await afterFirstPages();
    await r.refresh();
    if (run.cancelled) return;
    subscribeConvStream(selfInboxId, run);
    subscribeLiveStreams(run, r);
    await syncPreferences();
  } catch (e) {
    if (run.cancelled || e instanceof NoAccountError) { clearTimeout(run.initTimer); return; }
    if (!hasHomeRows()) args.setError((e as Error).message);
  }
}

export function useChannelsSync(args: SyncArgs): void {
  const { accountEpoch, setError } = args;
  useEffect(() => {
    setError('');
    const run: SyncRun = {
      cancelled: false,
      cancelConvStream: null, cancelMsgStream: null, cancelConsentStream: null, appStateSub: null,
    };
    const armInitTimer = (): void => {
      run.initTimer = setTimeout(() => {
        if (run.cancelled || hasHomeRows()) return;
        if (getXmtpBootstrapPhase() === 'registering') { armInitTimer(); return; }
        setError('XMTP failed to initialise (timed out). Tap Reset below to wipe the local identity and start fresh.');
      }, INIT_TIMEOUT_MS);
    };
    armInitTimer();
    const removeHidden = (): void => { if (homeRows() !== null) updateHomeRows(rows => rows); };
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
    void initSync(run, args);
    return (): void => {
      run.cancelled = true;
      stopVisibility();
      clearTimeout(run.initTimer);
      for (const stop of [run.cancelConvStream, run.cancelMsgStream, run.cancelConsentStream]) {
        if (stop) attempt(stop, 'cleanup');
      }
      const appStateSub = run.appStateSub;
      if (appStateSub) attempt(() => { appStateSub.remove(); }, 'cleanup');
    };
  }, [accountEpoch]);
}
