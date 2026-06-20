/** @file HomeScreen.sync — the useChannelsSync effect: XMTP boot, full refresh, conversation/message/consent streams and AppState resume for the channels list, extracted from HomeScreen.tsx. */

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

/** Mutable per-run state shared between init and cleanup of the sync effect. */
interface SyncRun {
  cancelled: boolean;
  initTimer: ReturnType<typeof setTimeout>;
  cancelConvStream: (() => void) | null;
  cancelMsgStream: (() => void) | null;
  cancelConsentStream: (() => void) | null;
  appStateSub: { remove: () => void } | null;
}

/** The refresh callbacks built once per run against the warm XMTP client. */
interface Refreshers {
  refresh: () => Promise<void>;
  refreshThrottled: () => Promise<void>;
  refreshRequestCount: () => Promise<void>;
}

/** Build the refresh/refreshThrottled/refreshRequestCount callbacks for a run. */
function makeRefreshers(
  client: Awaited<ReturnType<typeof getOrCreateXmtpClient>>, selfInboxId: string,
  run: SyncRun, args: SyncArgs,
): Refreshers {
  /** Coalesces the expensive full re-summarise since live streams already apply incremental deltas, so resume/consent triggers throttle. */
  let lastRefreshAt = 0;
  const THROTTLE_MS = 30_000;
  /** Recount pending message requests ('unknown' consent) — cheap, local conv list only. */
  const refreshRequestCount = async (): Promise<void> => {
    try {
      const reqs = await listRequestConvs();
      if (!run.cancelled) args.setRequestCount(reqs.length);
    } catch { /* swallow */ }
  };
  /** Full re-sync + re-summarise of the accepted-conv list (any event trigger can call it). */
  const refresh = async (): Promise<void> => {
    if (run.cancelled) return;
    try {
      await client.conversations.syncAllConversations(['allowed', 'unknown']);
      /** Main inbox = only ACCEPTED ('allowed') convs; 'unknown' are pending requests. */
      const convs = await client.conversations.list(undefined, undefined, ['allowed']);
      void refreshRequestCount();
      await primeMembers(client, convs);
      const summarized = await Promise.all(convs.map(c => summarize(c, selfInboxId)));
      if (run.cancelled) return;
      summarized.sort((a, b) => (b.lastTs ?? 0) - (a.lastTs ?? 0));
      args.setRows(summarized);
      lastRefreshAt = Date.now();
      clearTimeout(run.initTimer);
    } catch { /* swallow — event-driven triggers re-run refresh */ }
  };
  /** Throttled refresh for noisy resume/consent triggers; skips if one ran <30s ago. */
  const refreshThrottled = async (): Promise<void> => {
    if (run.cancelled || Date.now() - lastRefreshAt < THROTTLE_MS) return;
    await refresh();
  };
  return { refresh, refreshThrottled, refreshRequestCount };
}

/** #3 BATCH inbox resolution: prime the eth cache for every member inbox in one call. */
async function primeMembers(client: Awaited<ReturnType<typeof getOrCreateXmtpClient>>, convs: Conversation[]): Promise<void> {
  try {
    const memberLists = await Promise.all(convs.map(c =>
      (c as unknown as { members: () => Promise<{ inboxId: string }[]> })
        .members().then(ms => ms.map(m => m.inboxId)).catch(() => [] as string[]),
    ));
    await primeInboxEthCache(client, memberLists.flat());
  } catch { /* per-row resolveInboxEth still falls back */ }
}

/** Subscribe to newly-created conversations; stashes the canceller on the run. */
async function subscribeConvStream(
  client: Awaited<ReturnType<typeof getOrCreateXmtpClient>>, selfInboxId: string,
  run: SyncRun, args: SyncArgs, r: Refreshers,
): Promise<void> {
  try {
    /** RN xmtp types `stream` as Promise<void> but at runtime resolves to an unsubscribe fn. */
    const streamFn = client.conversations.stream.bind(client.conversations) as
      (cb: (conv: Conversation | null) => Promise<void>) => Promise<unknown>;
    const streamResult: unknown = await streamFn(async (conv) => {
      if (run.cancelled || !conv) return;
      /** A streamed 'unknown'-consent conv is a message request — count it, don't inbox it. */
      const cs = await (conv as unknown as { consentState: () => Promise<string> })
        .consentState().catch(() => 'allowed');
      if (cs !== 'allowed') { void r.refreshRequestCount(); return; }
      const row = await summarize(conv, selfInboxId);
      args.setRows(prev => (prev ? [row, ...prev.filter(x => x.convId !== row.convId)] : [row]));
    });
    run.cancelConvStream = typeof streamResult === 'function' ? (streamResult as () => void) : null;
  } catch { /* stream init failed — AppState resume re-runs refresh */ }
}

/** Subscribe message + consent streams and the AppState resume listener for a run. */
function subscribeLiveStreams(run: SyncRun, args: SyncArgs, r: Refreshers): void {
  /** #1 ONE STREAM: reuse the module-level streamAllMessages fan-out (reducer in HomeScreen.stream.ts). */
  try {
    run.cancelMsgStream = subscribeAllMessages(makeMsgStreamHandler({
      isCancelled: () => run.cancelled, setRows: args.setRows,
      refresh: r.refresh, refreshRequestCount: r.refreshRequestCount,
    }));
  } catch { /* message stream init failed — preview will lag */ }
  /** Live-reconcile consent changes (accept/block here or another device). */
  try {
    run.cancelConsentStream = streamConvConsent(() => {
      void (async (): Promise<void> => {
        await syncConsent(); void r.refresh(); void r.refreshRequestCount();
      })();
    });
  } catch { /* stream init failed — AppState resume re-runs refresh */ }
  /** Foreground resume — native streams often die while backgrounded; re-sync on active. */
  run.appStateSub = AppState.addEventListener('change', (state) => {
    if (state !== 'active') return;
    void syncPreferences(); void syncConsent();
    void r.refreshThrottled(); void r.refreshRequestCount();
  });
}

/** Boot XMTP, run the initial refresh, and wire all streams; handles NoAccountError quietly. */
async function initSync(run: SyncRun, args: SyncArgs): Promise<void> {
  try {
    const client = await getOrCreateXmtpClient('production');
    const selfInboxId = client.inboxId;
    const r = makeRefreshers(client, selfInboxId, run, args);
    args.refreshFromNetworkRef.current = r.refresh;
    await r.refresh();
    await subscribeConvStream(client, selfInboxId, run, args, r);
    subscribeLiveStreams(run, args, r);
    /** Pull synced preferences/consent on init (read/unread is per-device lastReadNs). */
    await syncPreferences();
    await syncConsent();
  } catch (e) {
    /** NoAccountError is NOT a failure: the effect ran under onboarding before the account existed, so wait for the epoch bump to re-run against a warm client. */
    if (run.cancelled || e instanceof NoAccountError) { clearTimeout(run.initTimer); return; }
    if (!args.rows || args.rows.length === 0) args.setError((e as Error).message);
  }
}

/** Drives the entire channels-list lifecycle; re-runs when `accountEpoch` changes (in-place account switch). */
export function useChannelsSync(args: SyncArgs): void {
  const { accountEpoch, rows, setRowsState, setError, refreshFromNetworkRef } = args;
  useEffect(() => {
    /** Clears any error from a previous run, since the first run fires before the account exists (under onboarding) and throws NoAccountError, which otherwise stuck a stale boot error on screen. */
    setError('');
    const run: SyncRun = {
      cancelled: false, initTimer: undefined as unknown as ReturnType<typeof setTimeout>,
      cancelConvStream: null, cancelMsgStream: null, cancelConsentStream: null, appStateSub: null,
    };
    /** Outer init timeout: surface recovery UI if boot+sync stalls and no cache is warm. */
    run.initTimer = setTimeout(() => {
      if (run.cancelled || (rows && rows.length > 0)) return;
      setError('XMTP failed to initialise (timed out). Tap Reset below to wipe the local identity and start fresh.');
    }, 30_000);
    /** Hydrate the persisted cache first so the list paints before XMTP finishes booting. */
    void hydrateCachedRows().then(cached => {
      if (run.cancelled) return;
      if (cached && Array.isArray(cached) && cached.length > 0 && !rows) setRowsState(cached as RowT[]);
    });
    void initSync(run, args);
    return (): void => {
      run.cancelled = true;
      clearTimeout(run.initTimer);
      refreshFromNetworkRef.current = null;
      if (run.cancelConvStream) try { run.cancelConvStream(); } catch { /* ignore */ }
      if (run.cancelMsgStream) try { run.cancelMsgStream(); } catch { /* ignore */ }
      if (run.cancelConsentStream) try { run.cancelConsentStream(); } catch { /* ignore */ }
      if (run.appStateSub) try { run.appStateSub.remove(); } catch { /* ignore */ }
    };
    /** Re-runs only on account switch (deps intentionally partial — react-hooks/exhaustive-deps not enabled). */
  }, [accountEpoch]);
}
