import { useEffect } from 'react';
import { AppState } from 'react-native';
import { makeValue } from '../storeCore';
import { useAccountEpoch } from '../accountEpoch';
import { syncPreferences, xmtpClient } from '../xmtp.client';
import { sdk } from '../xmtp.sdk';
import { AccountChangedError, NoAccountError } from '../accountSelection';
import { getXmtpBootstrapPhase, subscribeXmtpBootstrapPhase } from '../xmtp.state.core';
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
import { getCachedRows, hydrateCachedRows } from '../channelsCache';
import { summarizeConversation } from './conversation';
import { afterFirstPages } from '../feed/firstPages';
import { hydratePeerProfiles } from '../peerProfileCache';
import { perfLog, perfTime } from '../perf';
import { dmIdsByPeer } from '@stage-labs/client/xmtp/dmRoutes';
import { uniqueBy } from '@stage-labs/client/collections';
import { hasHomeRows, updateHomeRows } from './homeRows';
import type { CachedRow as Row } from '../cachedRows.model';
import { mergePaintedRows, visibleRowsDiff } from './channelsSync.model';
import { schedulePushTopicRefresh } from '../pushRegister';
import { report, reported, recover, attempt, ignored } from '../errorPolicy';
import { errorMessage } from '@stage-labs/client/errors';
import { loadHiddenChannels, subscribeHiddenChannelEdits } from '../sync/hiddenChannels';
import { makeMsgStreamHandler } from './channelsSync.inbound';
import { getActiveAccount } from '../accounts';

const INIT_TIMEOUT_MS = 30_000;

type Conv = Awaited<ReturnType<typeof listVisibleConversations>>[number];

async function summarize(conv: Conv, selfInboxId: string, alreadySynced = false): Promise<Row> {
  return { ...(await summarizeConversation(conv, selfInboxId, alreadySynced, dmIdsByPeer(getCachedRows() ?? []))) };
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
  stopPhaseWait?: () => void;
  refreshers: Promise<Refreshers>;
  ready: (refreshers: Refreshers) => void;
  fail: (err: unknown) => void;
}

interface Refreshers {
  refresh: () => Promise<void>;
  refreshThrottled: () => Promise<void>;
  reconcile: () => Promise<void>;
  repaint: (network: boolean) => Promise<RepaintResult>;
}

export interface RepaintResult {
  failed: boolean;
}

const PAINTED: RepaintResult = { failed: false };

function makeRefreshers(client: Awaited<ReturnType<typeof xmtpClient>>, selfInboxId: string, run: SyncRun): Refreshers {
  let lastRefreshAt = 0;
  const THROTTLE_MS = 30_000;
  const paintFrom = async (convs: Conv[]): Promise<RepaintResult> => {
    const beforeIds = (getCachedRows() ?? []).map((r) => r.convId);
    await primeConversationMembers(client, convs);
    const previous = new Map((getCachedRows() ?? []).map((r) => [r.convId, r]));
    let failed = false;
    const summarized = (
      await Promise.all(
        convs.map((c) =>
          summarize(c, selfInboxId, true).catch((err: unknown) => {
            failed = true;
            return recover('home.summarize', previous.get(c.id) ?? null)(err);
          }),
        ),
      )
    ).filter((r): r is Row => r !== null);
    if (run.cancelled) return { failed };
    updateHomeRows((prev) =>
      mergePaintedRows(
        beforeIds,
        prev,
        uniqueBy(summarized, (row) => row.convId),
      ),
    );
    lastRefreshAt = Date.now();
    clearTimeout(run.initTimer);
    return { failed };
  };
  const paintLocal = async (): Promise<RepaintResult> => {
    const local = await perfTime('channels.listLocal', listVisibleConversations);
    perfLog('channels.localCount', { count: local.length });
    return local.length > 0 ? perfTime('channels.paintLocal', () => paintFrom(local)) : PAINTED;
  };
  const sync = async (): Promise<RepaintResult> => {
    if (run.cancelled) return PAINTED;
    const local = sdk.storeChangesInBackground || !hasHomeRows() ? await paintLocal() : PAINTED;
    await perfTime('channels.syncNetwork', syncConversationsFromNetwork);
    if (run.cancelled) return local;
    const fresh = await listVisibleConversations();
    const painted = await perfTime('channels.paintFresh', () => paintFrom(fresh));
    return { failed: local.failed || painted.failed };
  };
  const refresh = async (): Promise<void> => {
    await sync().catch(reported('home.refresh'));
  };
  const refreshThrottled = async (): Promise<void> => {
    if (run.cancelled || Date.now() - lastRefreshAt < THROTTLE_MS) return;
    await refresh();
  };
  const reconcile = async (): Promise<void> => {
    try {
      const rows = getCachedRows();
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
  const repaint = (network: boolean): Promise<RepaintResult> => (network ? sync() : paintLocal());
  return { refresh, refreshThrottled, reconcile, repaint };
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
    run.ready(r);
    await hydratePeerProfiles();
    await afterFirstPages();
    await r.refresh();
    if (run.cancelled) return;
    subscribeConvStream(selfInboxId, run);
    subscribeLiveStreams(run, r, selfInboxId);
    await syncPreferences();
  } catch (e) {
    run.fail(e);
    if (run.cancelled || e instanceof NoAccountError) {
      clearTimeout(run.initTimer);
      return;
    }
    if (!hasHomeRows()) syncError.set(errorMessage(e));
  }
}

function armInitTimer(run: SyncRun): void {
  run.initTimer = setTimeout(() => {
    if (run.cancelled || hasHomeRows()) return;
    if (getXmtpBootstrapPhase() !== 'registering') {
      syncError.set(INIT_TIMEOUT_MESSAGE);
      return;
    }
    const stop = subscribeXmtpBootstrapPhase(() => {
      if (getXmtpBootstrapPhase() === 'registering') return;
      stop();
      if (!run.cancelled) armInitTimer(run);
    });
    run.stopPhaseWait = stop;
  }, INIT_TIMEOUT_MS);
}

function stopRun(run: SyncRun): void {
  run.cancelled = true;
  run.fail(new AccountChangedError());
  clearTimeout(run.initTimer);
  run.stopPhaseWait?.();
  for (const stop of [run.cancelConvStream, run.cancelMsgStream, run.cancelConsentStream]) {
    if (stop) attempt(stop, 'cleanup');
  }
  const appStateSub = run.appStateSub;
  if (appStateSub)
    attempt(() => {
      appStateSub.remove();
    }, 'cleanup');
}

function newRun(): SyncRun {
  let ready: SyncRun['ready'] = () => undefined;
  let fail: SyncRun['fail'] = () => undefined;
  const refreshers = new Promise<Refreshers>((resolve, reject) => {
    ready = resolve;
    fail = reject;
  });
  refreshers.catch(ignored(undefined, 'optional'));
  return {
    cancelled: false,
    cancelConvStream: null,
    cancelMsgStream: null,
    cancelConsentStream: null,
    appStateSub: null,
    refreshers,
    ready,
    fail,
  };
}

let currentRun: SyncRun | null = null;

export async function refreshChannels(network: boolean): Promise<RepaintResult> {
  const run = currentRun;
  if (run === null) throw new Error('Messaging is not ready.');
  const refreshers = await run.refreshers;
  if (run.cancelled) throw new AccountChangedError();
  return refreshers.repaint(network);
}

function startChannelsSync(): () => void {
  syncError.set('');
  const run = newRun();
  currentRun = run;
  armInitTimer(run);
  const removeHidden = (): void => {
    if (getCachedRows() !== null) updateHomeRows((rows) => rows);
  };
  const stopVisibility = subscribeHiddenChannelEdits(() => {
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
    if (currentRun === run) currentRun = null;
    stopRun(run);
    stopVisibility();
  };
}

export function useChannelsSync(active: boolean): void {
  const accountEpoch = useAccountEpoch();
  useEffect(() => (active ? startChannelsSync() : undefined), [accountEpoch, active]);
}
