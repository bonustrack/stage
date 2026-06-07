/** Channels-list backed by TanStack Query (stage 1 of the cache unification).
 *
 *  The existing per-account `channelsCache` (lib/channelsCache) stays ALIVE as
 *  the source of truth + fetcher: the Channels screen still owns the network
 *  sync + stream write-through into it. This module mirrors that cache into a
 *  Query key (['xmtp','channels',account]) so OTHER readers dedupe + get
 *  stale-while-revalidate off one entry instead of each wiring up their own
 *  subscribeCachedRows. Writes flow cache -> Query via setQueryData; the cache
 *  remains the single writer, Query is a read-mirror.
 *
 *  Account switching invalidates automatically: the key is scoped by the active
 *  account id (getActiveAccountIdSync), and setActiveAccountForCache re-notifies
 *  the cache subscription, which re-mirrors under the new account's key. */

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getCachedRows, subscribeCachedRows, hydrateCachedRows,
  getActiveAccountIdSync, type CachedRow,
} from '../../lib/channelsCache';
import { getQueryClient } from '../../lib/queryClient';
import { messagingKeys } from './queries';

/** Push the cache's current rows into the active account's Query entry. Called
 *  on every cache notification so Query mirrors the cache write-through. */
function mirrorRows(rows: CachedRow[] | null): void {
  const key = messagingKeys.channels(getActiveAccountIdSync());
  getQueryClient().setQueryData<CachedRow[] | null>(key, rows);
}

/** Subscribe-once bridge: mirror cache -> Query for the lifetime of the app.
 *  Idempotent guard so multiple hook mounts don't stack subscriptions. */
let bridged = false;
export function ensureChannelsQueryBridge(): void {
  if (bridged) return;
  bridged = true;
  /** Seed Query from the cache's current in-memory snapshot + disk, then mirror
   *  every subsequent cache write (network sync + stream write-through). */
  mirrorRows(getCachedRows());
  void hydrateCachedRows().then(mirrorRows);
  subscribeCachedRows(mirrorRows);
}

/** Read the active account's channels list through Query (dedup + SWR). The
 *  channelsCache stays the writer; this just exposes its rows as a Query so
 *  read-only consumers don't each re-implement the subscription. Returns the
 *  rows array (or null before the first hydrate lands). */
export function useChannelsQuery(): CachedRow[] | null {
  useEffect(() => { ensureChannelsQueryBridge(); }, []);
  const account = getActiveAccountIdSync();
  const { data } = useQuery({
    queryKey: messagingKeys.channels(account),
    /** The cache is the fetcher: resolve to whatever it currently holds (sync
     *  in-memory snapshot, or the hydrated disk value). Live updates arrive via
     *  the cache-bridge setQueryData, not by re-running this. */
    queryFn: async () => getCachedRows() ?? (await hydrateCachedRows()),
    staleTime: 60_000,
    /** Keep the previous account's data off the screen on switch: the key change
     *  swaps to the new account's entry, mirrored by the cache bridge. */
    initialData: () => getCachedRows(),
  });
  return data ?? null;
}
