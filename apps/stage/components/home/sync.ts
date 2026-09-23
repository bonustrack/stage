
import { useEffect, type Dispatch, type SetStateAction } from 'react';
import { AppState } from 'react-native';
import {
  getOrCreateXmtpClient, NoAccountError,
  syncPreferences, getXmtpBootstrapPhase,
  primeConversationMembers, subscribeAllMessages,
  listVisibleConversations, syncConversationsFromNetwork,
  streamNewConversations, streamConvConsent, syncConsent, conversationIsSyncGroup, getConvConsentState,
} from '../../modules/messaging';
import { hydrateCachedRows, setCachedRows, summarizeConversation } from '../../modules/messaging';
import { hydratePeerProfiles } from '../../lib/peerProfiles';
import { perfLog, perfTime } from '../../lib/perf';
import type { Conversation } from '@xmtp/react-native-sdk';
import { makeMsgStreamHandler } from './stream';
import { homeRows, updateHomeRows } from './state';
import type { Row } from './model';
import { registerHiddenConv } from '../../lib/readSyncRegistry';
import { schedulePushTopicRefresh } from '../../lib/pushRegister';
import { report, recover, attempt } from '../../lib/errorPolicy';

const INIT_TIMEOUT_MS = 30_000;

async function summarize(conv: Conversation, selfInboxId: string, alreadySynced = false): Promise<Row> {
  return { ...await summarizeConversation(conv, selfInboxId, alreadySynced) };
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
  appStateSub: { remove: () => void } | null;
}

interface Refreshers {
  refresh: () => Promise<void>;
  refreshThrottled: () => Promise<void>;
}

function makeRefreshers(
  client: Awaited<ReturnType<typeof getOrCreateXmtpClient>>, selfInboxId: string,
  run: SyncRun,
): Refreshers {
  let lastRefreshAt = 0;
  const THROTTLE_MS = 30_000;
  const paintFrom = async (convs: Conversation[]): Promise<boolean> => {
    await primeConversationMembers(client, convs);
    const previous = new Map((homeRows() ?? []).map(r => [r.convId, r]));
    const summarized = (await Promise.all(
      convs.map(c => summarize(c, selfInboxId, true).catch(() => previous.get(c.id) ?? null)),
    )).filter((r): r is Row => r !== null);
    if (run.cancelled) return false;
    summarized.sort((a, b) => (b.lastTs ?? 0) - (a.lastTs ?? 0));
    setCachedRows(summarized);
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
    } catch (err) {
      report('home.refresh', err);
    }
  };
  const refreshThrottled = async (): Promise<void> => {
    if (run.cancelled || Date.now() - lastRefreshAt < THROTTLE_MS) return;
    await refresh();
  };
  return { refresh, refreshThrottled };
}

async function onNewConversation(conv: Conversation, selfInboxId: string, run: SyncRun): Promise<void> {
  schedulePushTopicRefresh();
  if (await conversationIsSyncGroup(conv).catch(recover('home.newConversation', false))) { registerHiddenConv(conv.id); return; }
  if ((await getConvConsentState(conv.id).catch(recover('home.newConversation', null))) === 'denied') return;
  const row = await summarize(conv, selfInboxId).catch(recover('home.newConversation', null));
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
  try {
    run.cancelMsgStream = subscribeAllMessages(makeMsgStreamHandler({
      isCancelled: () => run.cancelled, refresh: r.refresh,
    }));
  } catch (err) {
    report('home.messageStream', err);
  }
  try {
    run.cancelConsentStream = streamConvConsent(() => {
      void (async (): Promise<void> => {
        await syncConsent(); void r.refresh();
      })();
    });
  } catch (err) {
    report('home.consentStream', err);
  }
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
    const r = makeRefreshers(client, selfInboxId, run);
    await hydratePeerProfiles();
    await r.refresh();
    if (run.cancelled) return;
    subscribeConvStream(selfInboxId, run);
    subscribeLiveStreams(run, r);
    await syncPreferences();
    await syncConsent();
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
    void hydrateCachedRows();
    void hydratePeerProfiles();
    void initSync(run, args);
    return (): void => {
      run.cancelled = true;
      clearTimeout(run.initTimer);
      for (const stop of [run.cancelConvStream, run.cancelMsgStream, run.cancelConsentStream]) {
        if (stop) attempt(stop, 'cleanup');
      }
      const appStateSub = run.appStateSub;
      if (appStateSub) attempt(() => { appStateSub.remove(); }, 'cleanup');
    };
  }, [accountEpoch]);
}
