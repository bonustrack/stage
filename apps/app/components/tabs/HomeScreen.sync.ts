/** HomeScreen network/sync effect — the XMTP boot, full refresh, conv/message/
 *  consent streams, AppState resume + slow-poll backstops, extracted from
 *  HomeScreen.tsx (phase-2 lint, behaviour identical). */

import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { AppState } from 'react-native';
import {
  getOrCreateXmtpClient,
  syncPreferences,
  primeInboxEthCache, subscribeAllMessages,
  listRequestConvs, streamConvConsent, syncConsent,
} from '../../modules/messaging';
import { hydrateCachedRows } from '../../lib/channelsCache';
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

/** Drives the entire channels-list lifecycle; re-runs when `accountEpoch`
 *  changes (in-place account switch). Mirrors the original inline effect. */
export function useChannelsSync({
  accountEpoch, rows, setRowsState, setRows, setError, setRequestCount, refreshFromNetworkRef,
}: SyncArgs): void {
  useEffect(() => {
    let cancelled = false;
    let cancelConvStream: (() => void) | null = null;
    let cancelMsgStream: (() => void) | null = null;
    let cancelConsentStream: (() => void) | null = null;
    // `number` (RN timer id): the Railgun SDK pulls @types/node into the type
    // program, whose Timeout collides with the DOM lib at clearInterval().
    let pollTimer: number | null = null;
    let appStateSub: { remove: () => void } | null = null;

    /** Hydrate the persisted cache first — if we have rows from a previous
     *  session, render them immediately so the user sees the channels list
     *  before XMTP finishes initialising. The network refresh below then
     *  reconciles any changes. */
    void hydrateCachedRows().then(cached => {
      if (cancelled) return;
      if (cached && Array.isArray(cached) && cached.length > 0 && !rows) {
        setRowsState(cached as RowT[]);
      }
    });

    /** Outer init timeout — if XMTP boot+sync hasn't finished in 30s AND we
     *  have no cached rows to render, surface an error + recovery UI instead
     *  of leaving the user staring at a spinner. Skipped when cache is warm. */
    const initTimer = setTimeout(() => {
      if (cancelled || (rows && rows.length > 0)) return;
      setError('XMTP failed to initialise (timed out). Tap Reset below to wipe the local identity and start fresh.');
    }, 30_000);

    void (async (): Promise<void> => {
      try {
        const client = await getOrCreateXmtpClient('production');
        const selfInboxId = client.inboxId;

        /** Recount pending message requests ('unknown' consent). Cheap — only
         *  reads the local conv list (synced separately by listRequestConvs). */
        const refreshRequestCount = async (): Promise<void> => {
          try {
            const reqs = await listRequestConvs();
            if (!cancelled) setRequestCount(reqs.length);
          } catch { /* swallow */ }
        };

        /** Reusable refresh that any backstop (AppState resume, slow poll,
         *  pull-to-refresh, unknown-conv stream hit) can call to re-sync +
         *  re-summarise the full list. */
        const refresh = async (): Promise<void> => {
          if (cancelled) return;
          try {
            await client.conversations.syncAllConversations(['allowed', 'unknown']);
            /** Main inbox = only ACCEPTED convs ('allowed'). The 'unknown'
             *  convs are pending message requests, surfaced separately via the
             *  Requests entry (count refreshed alongside). */
            const convs = await client.conversations.list(undefined, undefined, ['allowed']);
            void refreshRequestCount();
            /** #3 BATCH inbox resolution: collect every member inbox id across all
             *  convs in parallel, then resolve the uncached ones in ONE
             *  inboxStates(true, [...]) call so per-row summarise hits the cache
             *  (kills the per-row N+1 GetIdentityUpdates that caused the outage). */
            try {
              const memberLists = await Promise.all(convs.map(c =>
                (c as unknown as { members: () => Promise<{ inboxId: string }[]> })
                  .members().then(ms => ms.map(m => m.inboxId)).catch(() => [] as string[]),
              ));
              await primeInboxEthCache(client, memberLists.flat());
            } catch { /* per-row resolveInboxEth still falls back */ }
            const summarized = await Promise.all(convs.map(c => summarize(c, selfInboxId)));
            if (cancelled) return;
            summarized.sort((a, b) => (b.lastTs ?? 0) - (a.lastTs ?? 0));
            setRows(summarized);
            clearTimeout(initTimer);
          } catch { /* swallow — backstops keep firing */ }
        };
        refreshFromNetworkRef.current = refresh;

        await refresh();

        /** Subscribe to newly-created conversations so groups + DMs created
         *  while the tab is mounted show up without a manual refresh. */
        try {
          cancelConvStream = await client.conversations.stream(async (conv) => {
            if (cancelled || !conv) return;
            /** A streamed conv we haven't accepted yet ('unknown') is a message
             *  request — surface it in the Requests count, not the inbox. */
            const cs = await (conv as unknown as { consentState: () => Promise<string> })
              .consentState().catch(() => 'allowed');
            if (cs !== 'allowed') { void refreshRequestCount(); return; }
            const r = await summarize(conv, selfInboxId);
            setRows(prev => {
              const next = prev ? [r, ...prev.filter(x => x.convId !== r.convId)] : [r];
              return next;
            });
          }) ?? null;
        } catch { /* stream init failed — backstops will pick it up */ }

        /** Subscribe to every new message across all convs so the per-row
         *  lastTs + lastPreview reflect activity in real time.
         *  #1 ONE STREAM: subscribe to the single module-level
         *  streamAllMessages fan-out in lib/xmtp instead of starting our own
         *  (every inbound used to be decoded twice — here + the conv-view feed).
         *  The reducer that turns a message into a row update lives in
         *  HomeScreen.stream.ts. */
        try {
          cancelMsgStream = subscribeAllMessages(makeMsgStreamHandler({
            isCancelled: () => cancelled,
            setRows,
            refresh,
          }));
        } catch { /* message stream init failed — preview will lag */ }

        /** Pull synced preferences from the network on init. Read/unread is now
         *  per-device (lastReadNs), so there's no consent stream to subscribe to. */
        await syncPreferences();
        await syncConsent();

        /** Live-reconcile when a conv is accepted/blocked (here or on another
         *  device): re-pull consent, then re-summarise the inbox + recount
         *  requests so an accepted request appears + the badge drops. */
        try {
          cancelConsentStream = streamConvConsent(() => {
            void (async (): Promise<void> => {
              await syncConsent();
              void refresh();
              void refreshRequestCount();
            })();
          });
        } catch { /* stream init failed — AppState resume backstops it */ }

        /** Foreground resume — the native streams often die while the app is
         *  backgrounded; re-sync on every active transition. */
        appStateSub = AppState.addEventListener('change', (state) => {
          if (state === 'active') {
            void syncPreferences(); void syncConsent();
            void refresh(); void refreshRequestCount();
          }
        });

        /** Slow poll as a last-resort backstop. Catches anything the stream
         *  dropped (network blip, push-without-stream, etc.). 30s is gentle
         *  on battery + bandwidth while still feeling live. */
        pollTimer = setInterval(() => { void refresh(); }, 30_000) as unknown as number;
      } catch (e) {
        if (!rows || rows.length === 0) setError((e as Error).message);
      }
    })();

    return (): void => {
      cancelled = true;
      clearTimeout(initTimer);
      refreshFromNetworkRef.current = null;
      if (cancelConvStream) try { cancelConvStream(); } catch { /* ignore */ }
      if (cancelMsgStream) try { cancelMsgStream(); } catch { /* ignore */ }
      if (cancelConsentStream) try { cancelConsentStream(); } catch { /* ignore */ }
      if (appStateSub) try { appStateSub.remove(); } catch { /* ignore */ }
      if (pollTimer) clearInterval(pollTimer);
    };
    /** Re-runs only on account switch (deps intentionally partial —
     *  react-hooks/exhaustive-deps not enabled). */
  }, [accountEpoch]);
}
