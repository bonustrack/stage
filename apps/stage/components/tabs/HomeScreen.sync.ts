
import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { AppState } from 'react-native';
import {
  getOrCreateXmtpClient, NoAccountError,
  syncPreferences,
  primeInboxEthCache, subscribeAllMessages,
  listRequestConvs, streamConvConsent, syncConsent,
} from '../../modules/messaging';
import { hydrateCachedRows } from '../../modules/messaging';
import type { Conversation } from '@xmtp/react-native-sdk';
import type { Row as RowT } from './HomeScreen.helpers';
import { summarize } from './HomeScreen.helpers';
import { makeMsgStreamHandler } from './HomeScreen.stream';

interface SyncArgs {
  accountEpoch: number;
  rows: RowT[] | null;
  setRowsState: Dispatch<SetStateAction<RowT[] | null>>;
  setRows: (next: RowT[] | null | ((p: RowT[] | null) => RowT[] | null)) => void;
  setError: Dispatch<SetStateAction<string>>;
  setRequestCount: Dispatch<SetStateAction<number>>;
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
  refreshRequestCount: () => Promise<void>;
}

function makeRefreshers(
  client: Awaited<ReturnType<typeof getOrCreateXmtpClient>>, selfInboxId: string,
  run: SyncRun, args: SyncArgs,
): Refreshers {
  let lastRefreshAt = 0;
  const THROTTLE_MS = 30_000;
  const refreshRequestCount = async (): Promise<void> => {
    try {
      const reqs = await listRequestConvs();
      if (!run.cancelled) args.setRequestCount(reqs.length);
    } catch { }
  };
  const refresh = async (): Promise<void> => {
    if (run.cancelled) return;
    try {
      await client.conversations.syncAllConversations(['allowed', 'unknown']);
      const convs = await client.conversations.list(undefined, undefined, ['allowed']);
      void refreshRequestCount();
      await primeMembers(client, convs);
      const summarized = await Promise.all(convs.map(c => summarize(c, selfInboxId)));
      if (run.cancelled) return;
      summarized.sort((a, b) => (b.lastTs ?? 0) - (a.lastTs ?? 0));
      args.setRows(summarized);
      lastRefreshAt = Date.now();
      clearTimeout(run.initTimer);
    } catch { }
  };
  const refreshThrottled = async (): Promise<void> => {
    if (run.cancelled || Date.now() - lastRefreshAt < THROTTLE_MS) return;
    await refresh();
  };
  return { refresh, refreshThrottled, refreshRequestCount };
}

async function primeMembers(client: Awaited<ReturnType<typeof getOrCreateXmtpClient>>, convs: Conversation[]): Promise<void> {
  try {
    const memberLists = await Promise.all(convs.map(c =>
      (c as unknown as { members: () => Promise<{ inboxId: string }[]> })
        .members().then(ms => ms.map(m => m.inboxId)).catch(() => [] as string[]),
    ));
    await primeInboxEthCache(client, memberLists.flat());
  } catch { }
}

async function subscribeConvStream(
  client: Awaited<ReturnType<typeof getOrCreateXmtpClient>>, selfInboxId: string,
  run: SyncRun, args: SyncArgs, r: Refreshers,
): Promise<void> {
  try {
    const streamFn = client.conversations.stream.bind(client.conversations) as
      (cb: (conv: Conversation | null) => Promise<void>) => Promise<unknown>;
    const streamResult: unknown = await streamFn(async (conv) => {
      if (run.cancelled || !conv) return;
      const cs = await (conv as unknown as { consentState: () => Promise<string> })
        .consentState().catch(() => 'allowed');
      if (cs !== 'allowed') { void r.refreshRequestCount(); return; }
      const row = await summarize(conv, selfInboxId);
      args.setRows(prev => (prev ? [row, ...prev.filter(x => x.convId !== row.convId)] : [row]));
    });
    run.cancelConvStream = typeof streamResult === 'function' ? (streamResult as () => void) : null;
  } catch { }
}

function subscribeLiveStreams(run: SyncRun, args: SyncArgs, r: Refreshers): void {
  try {
    run.cancelMsgStream = subscribeAllMessages(makeMsgStreamHandler({
      isCancelled: () => run.cancelled, setRows: args.setRows,
      refresh: r.refresh, refreshRequestCount: r.refreshRequestCount,
    }));
  } catch { }
  try {
    run.cancelConsentStream = streamConvConsent(() => {
      void (async (): Promise<void> => {
        await syncConsent(); void r.refresh(); void r.refreshRequestCount();
      })();
    });
  } catch { }
  run.appStateSub = AppState.addEventListener('change', (state) => {
    if (state !== 'active') return;
    void syncPreferences(); void syncConsent();
    void r.refreshThrottled(); void r.refreshRequestCount();
  });
}

async function initSync(run: SyncRun, args: SyncArgs): Promise<void> {
  try {
    const client = await getOrCreateXmtpClient('production');
    const selfInboxId = client.inboxId;
    const r = makeRefreshers(client, selfInboxId, run, args);
    args.refreshFromNetworkRef.current = r.refresh;
    await r.refresh();
    await subscribeConvStream(client, selfInboxId, run, args, r);
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
    void hydrateCachedRows().then(cached => {
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
