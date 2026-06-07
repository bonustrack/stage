/** TanStack-Query bridge for the per-conversation message FEED (stage 2).
 *
 *  The feed is push-driven: the single app-wide XMTP stream, optimistic sends,
 *  reactions, the initial history load + the resync backstop all WRITE THROUGH
 *  `feedCache` (a MemoryStore slice keyed by metro line). feedCache stays the
 *  source of truth + the offline/session cache - this stage does NOT retire it.
 *
 *  What changes: feed READS now flow through Query. We mirror each feedCache
 *  slice into the `['xmtp','messages',convId]` query key via setQueryData, and
 *  `useXmtpFeed` returns the Query-cached array. This gives the feed the same
 *  dedupe / shared-cache surface stage 1 gave convMeta + channels, WITHOUT
 *  re-implementing the protocol/decoding or changing any write path. The Query
 *  entry is a passive mirror: feedCache is written, Query reflects it, the
 *  observer re-renders with the identical HistoryEntry[] (same order, same
 *  optimistic bubbles - the optimistic layer sits ABOVE this on `events`).
 *
 *  Account switch: feedCache.clear() in resetClientScopedState fires the slice
 *  subscription with `undefined`; we mirror that to an empty array and the feed
 *  re-inits against the new inbox (useXmtpFeed re-runs on accountEpoch). The
 *  helper here also exposes explicit invalidation for that path. */

import { useEffect, useSyncExternalStore } from 'react';
import { hashKey } from '@tanstack/react-query';
import { getQueryClient } from '../../lib/queryClient';
import { feedCache, registerFeedQueriesReset } from '../../lib/xmtp.state';
import type { HistoryEntry } from '../../lib/types';
import { messagingKeys } from './queries';

/** Push the current feedCache slice for `line` into the messages query key so a
 *  mounted observer (or an imperative reader) sees the same array Query holds.
 *  Idempotent + cheap: setQueryData with the SAME reference is a no-op render. */
export function mirrorFeedSlice(line: string, convId: string): void {
  const slice = feedCache.get(line) ?? [];
  getQueryClient().setQueryData<HistoryEntry[]>(messagingKeys.messages(convId), slice);
}

/** Imperative read of the cached feed for a conv (no subscription). */
export function getCachedFeed(convId: string): HistoryEntry[] {
  return getQueryClient().getQueryData<HistoryEntry[]>(messagingKeys.messages(convId)) ?? [];
}

/** Drop a conv's feed query entry (account switch / explicit reset). The next
 *  mirror re-seeds it from feedCache. */
export function resetFeedQuery(convId: string): void {
  getQueryClient().removeQueries({ queryKey: messagingKeys.messages(convId) });
}

/** Drop EVERY conv's feed query entry. Called on account switch (alongside
 *  feedCache.clear()) so a stale account's mirrored slices never leak into the
 *  new inbox's feed. Matches the ['xmtp','messages'] key prefix; convMeta +
 *  channels keys are left untouched (they have their own scoping). */
export function resetAllFeedQueries(): void {
  getQueryClient().removeQueries({ queryKey: ['xmtp', 'messages'] });
}

/** Wire account-switch feed-query cleanup into resetClientScopedState. Runs once
 *  at module load (this module is imported by useXmtpFeed, so it's live whenever
 *  a feed renders). */
registerFeedQueriesReset(resetAllFeedQueries);

const EMPTY: HistoryEntry[] = [];

/** Subscribe a component to a conv's feed via Query, mirroring feedCache writes
 *  into the query key. `line` is the metro line (feedCache key); `convId` is the
 *  query key segment. Returns the Query-cached HistoryEntry[].
 *
 *  Implementation note: we read the query cache through useSyncExternalStore so
 *  the value is always the latest setQueryData result (no stale snapshot), and
 *  we keep the mirror in sync by subscribing to BOTH the feedCache slice (write
 *  source) and the query cache (render source). When `enabled` is false or there
 *  is no line/convId, the hook returns the empty array and writes nothing. */
export function useFeedQuery(
  line: string | null,
  convId: string | undefined,
  enabled: boolean,
): HistoryEntry[] {
  const active = enabled && !!line && !!convId;

  /** Mirror feedCache → Query for this slice, seeding immediately on mount and on
   *  every subsequent feedCache write. Teardown leaves the query entry in place
   *  (warm re-open) - account switch clears it via feedCache.clear()'s mirror. */
  useEffect(() => {
    if (!active || !line || !convId) return;
    mirrorFeedSlice(line, convId);
    const unsub = feedCache.subscribe(line, (slice) => {
      getQueryClient().setQueryData<HistoryEntry[]>(
        messagingKeys.messages(convId),
        slice ?? EMPTY,
      );
    });
    return unsub;
  }, [active, line, convId]);

  /** Render source: the query cache entry, kept fresh via the cache subscription
   *  so each setQueryData above re-renders the observer with the new array. */
  const qc = getQueryClient();
  const key = messagingKeys.messages(convId);
  const keyHash = hashKey(key);
  /** getSnapshot prefers the Query entry, but falls back to the live feedCache
   *  slice when Query has not been seeded yet (first render before the mirror
   *  effect runs). This preserves the warm-cache instant paint (no empty flash)
   *  the local-state hook had, while still reading through Query once seeded. */
  return useSyncExternalStore(
    (cb) => qc.getQueryCache().subscribe((ev) => {
      if (ev?.query?.queryHash === keyHash) cb();
    }),
    () => {
      if (!active || !line) return EMPTY;
      return qc.getQueryData<HistoryEntry[]>(key) ?? feedCache.get(line) ?? EMPTY;
    },
    () => EMPTY,
  );
}
