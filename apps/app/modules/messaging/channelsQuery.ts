/**
 * @file Mirrors the per-account channelsCache (which stays the single writer + source of truth) into a TanStack Query key so other readers dedupe and get stale-while-revalidate, with the key scoped to the active account for automatic invalidation on switch.
 */

import {
  getCachedRows, subscribeCachedRows, hydrateCachedRows,
  getActiveAccountIdSync, type CachedRow,
} from '../../lib/channelsCache';
import { getQueryClient } from '../../lib/queryClient';
import { messagingKeys } from './queries';

/** Push the cache's current rows into the active account's Query entry. Called on every cache notification so Query mirrors the cache write-through. */
function mirrorRows(rows: CachedRow[] | null): void {
  const key = messagingKeys.channels(getActiveAccountIdSync());
  getQueryClient().setQueryData<CachedRow[] | null>(key, rows);
}

/** Subscribe-once bridge: mirror cache -> Query for the lifetime of the app. Idempotent guard so multiple hook mounts don't stack subscriptions. */
let bridged = false;
/** Wire the cache->Query mirror once for the app's lifetime (idempotent). */
export function ensureChannelsQueryBridge(): void {
  if (bridged) return;
  bridged = true;
  /** Seed Query from the cache's current in-memory snapshot + disk, then mirror every subsequent cache write (network sync + stream write-through). */
  mirrorRows(getCachedRows());
  void hydrateCachedRows().then(mirrorRows);
  subscribeCachedRows(mirrorRows);
}
