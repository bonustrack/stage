
import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { AppState } from 'react-native';
import {
  getOrCreateXmtpClient, NoAccountError,
  syncPreferences,
  primeConversationMembers, subscribeAllMessages,
  listVisibleConversations, syncConversationsFromNetwork,
  streamNewConversations, streamConvConsent, syncConsent, conversationIsSyncGroup,
} from '../../modules/messaging';
import { hydrateCachedRows } from '../../modules/messaging';
import { hydratePeerProfiles } from '../../lib/peerProfiles';
import { perfLog, perfTime } from '../../lib/perf';
import type { Conversation } from '@xmtp/react-native-sdk';
import type { Row as RowT } from './HomeScreen.helpers';
import { summarize } from './HomeScreen.helpers';
import { makeMsgStreamHandler } from './HomeScreen.stream';
import { registerHiddenConv } from '../../lib/readSyncRegistry';
import { schedulePushTopicRefresh } from '../../lib/pushRegister';

interface SyncArgs {
  accountEpoch: number;
  rows: RowT[] | null;
  setRowsState: Dispatch<SetStateAction<RowT[] | null>>;
  setRows: (next: RowT[] | null | ((p: RowT[] | null) => RowT[] | null)) => void;
  setError: Dispatch<SetStateAction<string>>;
  refreshFromNetworkRef: MutableRefObject<(() => Promise<void>) | null>;
}

interface SyncRun {
  cancelled: boolean;
  initTimer: ReturnType<typeof setTimeout>;
  cancelConvStream: (() => void) | null;
  cancelMsgStream: (() => void) | null;
  cancelConsentStream: (() => void) | null;
  appStateSub: { remove: () => void } | null;
}

interface Refreshers {
  refresh: () => Promise<void>;
  refreshThrottled: () => Promise<void>;
}

function makeRefreshers(
  client: Awaited<ReturnType<typeof getOrCreateXmtpClient>>, selfInboxId: string,
  run: SyncRun, args: SyncArgs,
): Refreshers {
  let lastRefreshAt = 0;
  const THROTTLE_MS = 30_000;
  const paintFrom = async (convs: Conversation[]): Promise<boolean> => {
    await primeConversationMembers(client, convs);
    const summarized = (await Promise.all(
      convs.map(c => summarize(c, selfInboxId, true).catch(() => null)),
    )).filter((r): r is RowT => r !== null);
    if (run.cancelled) return false;
    summarized.sort((a, b) => (b.lastTs ?? 0) - (a.lastTs ?? 0));
    args.setRows(summarized);
    lastRefreshAt = Date.now();
    clearTimeout(run.initTimer);
    return true;
  };
  const refresh = async (): Promise<void> => {
    if (run.cancelled) return;
    try {
      const local = await perfTime('channels.listLocal', listVisibleConversations);
      perfLog('channels.localCount', { count: local.length });
      if (local.length > 0) await perfTime('channels.paintLocal', () => paintFrom(local));
      await perfTime('channels.syncNetwork', syncConversationsFromNetwork);
      if (run.cancelled) return;
      const fresh = await listVisibleConversations();
      await perfTime('channels.paintFresh', () => paintFrom(fresh));
    } catch { }
  };
  const refreshThrottled = async (): Promise<void> => {
    if (run.cancelled || Date.now() - lastRefreshAt < THROTTLE_MS) return;
    await refresh();
  };
  return { refresh, refreshThrottled };
}

async function onNewConversation(conv: Conversation, selfInboxId: string, run: SyncRun, args: SyncArgs): Promise<void> {
  schedulePushTopicRefresh();
  if (await conversationIsSyncGroup(conv).catch(() => false)) { registerHiddenConv(conv.id); return; }
  if ((await conv.consentState().catch(() => 'allowed')) === 'denied') return;
  const row = await summarize(conv, selfInboxId).catch(() => null);
  if (!row || run.cancelled) return;
  args.setRows(prev => (prev ? [row, ...prev.filter(x => x.convId !== row.convId)] : [row]));
}

function subscribeConvStream(selfInboxId: string, run: SyncRun, args: SyncArgs): void {
  try {
    run.cancelConvStream = streamNewConversations((conv) => {
      if (!run.cancelled) void onNewConversation(conv, selfInboxId, run, args);
    });
  } catch { }
}

function subscribeLiveStreams(run: SyncRun, args: SyncArgs, r: Refreshers): void {
  try {
    run.cancelMsgStream = subscribeAllMessages(makeMsgStreamHandler({
      isCancelled: () => run.cancelled, setRows: args.setRows,
      refresh: r.refresh,
    }));
  } catch { }
  try {
    run.cancelConsentStream = streamConvConsent(() => {
      void (async (): Promise<void> => {
        await syncConsent(); void r.refresh();
      })();
    });
  } catch { }
  run.appStateSub = AppState.addEventListener('change', (state) => {
    if (state !== 'active') return;
    void syncPreferences(); void syncConsent();
    void r.refreshThrottled();
  });
}

async function initSync(run: SyncRun, args: SyncArgs): Promise<void> {
  try {
    const client = await getOrCreateXmtpClient('production');
    clearTimeout(run.initTimer);
    const selfInboxId = client.inboxId;
    const r = makeRefreshers(client, selfInboxId, run, args);
    args.refreshFromNetworkRef.current = r.refresh;
    await hydratePeerProfiles();
    await r.refresh();
    subscribeConvStream(selfInboxId, run, args);
    subscribeLiveStreams(run, args, r);
    await syncPreferences();
    await syncConsent();
  } catch (e) {
    if (run.cancelled || e instanceof NoAccountError) { clearTimeout(run.initTimer); return; }
    if (!args.rows || args.rows.length === 0) args.setError((e as Error).message);
  }
}

export function useChannelsSync(args: SyncArgs): void {
  const { accountEpoch, rows, setRowsState, setError, refreshFromNetworkRef } = args;
  useEffect(() => {
    setError('');
    const run: SyncRun = {
      cancelled: false, initTimer: undefined as unknown as ReturnType<typeof setTimeout>,
      cancelConvStream: null, cancelMsgStream: null, cancelConsentStream: null, appStateSub: null,
    };
    run.initTimer = setTimeout(() => {
      if (run.cancelled || (rows && rows.length > 0)) return;
      setError('XMTP failed to initialise (timed out). Tap Reset below to wipe the local identity and start fresh.');
    }, 30_000);
    void Promise.all([hydrateCachedRows(), hydratePeerProfiles()]).then(([cached]) => {
      if (run.cancelled) return;
      if (cached && Array.isArray(cached) && cached.length > 0 && !rows) setRowsState(cached as RowT[]);
    });
    void initSync(run, args);
    return (): void => {
      run.cancelled = true;
      clearTimeout(run.initTimer);
      refreshFromNetworkRef.current = null;
      if (run.cancelConvStream) try { run.cancelConvStream(); } catch { }
      if (run.cancelMsgStream) try { run.cancelMsgStream(); } catch { }
      if (run.cancelConsentStream) try { run.cancelConsentStream(); } catch { }
      if (run.appStateSub) try { run.appStateSub.remove(); } catch { }
    };
  }, [accountEpoch]);
}
