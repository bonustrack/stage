/** Total unread-message count across all non-archived conversations.
 *
 *  Reuses the EXISTING unread mechanism: the per-account `channelsCache` rows
 *  (each carries `unreadCount` + `markedUnread`, maintained by the live stream
 *  and cleared on read) and the device-local `archived` set. We do NOT invent a
 *  new counter; we just sum what the Channels list already tracks.
 *
 *  Live: subscribes to both `subscribeCachedRows` (new inbound bumps a row's
 *  count, reading a conv clears it, account switch swaps the row set) and
 *  `subscribeArchived` (archiving a conv removes it from the total), so the
 *  footer badge updates the instant the count changes. */

import { useEffect, useState } from 'react';
import { getCachedRows, subscribeCachedRows, type CachedRow } from './channelsCache';
import { isArchived, loadArchivedIds, subscribeArchived } from './archived';
import { isMuted, loadMutedIds, subscribeMuted } from './muted';

/** Sum unread across non-archived, non-muted rows. A `markedUnread` row with no
 *  counted messages still contributes 1 so the badge mirrors the per-row
 *  indicator. Muted convs never contribute (mute hides the badge). */
function computeTotal(rows: CachedRow[] | null): number {
  if (!rows) return 0;
  let total = 0;
  for (const r of rows) {
    if (isArchived(r.convId) || isMuted(r.convId)) continue;
    const count = typeof r.unreadCount === 'number' ? r.unreadCount : 0;
    if (count > 0) total += count;
    else if (r.markedUnread) total += 1;
  }
  return total;
}

export function useTotalUnread(): number {
  const [total, setTotal] = useState<number>(() => computeTotal(getCachedRows()));

  useEffect(() => {
    let mounted = true;
    const recompute = (): void => {
      if (mounted) setTotal(computeTotal(getCachedRows()));
    };
    // Ensure the archived + muted sets are hydrated, then reconcile once.
    void loadArchivedIds().then(recompute);
    void loadMutedIds().then(recompute);
    const offRows = subscribeCachedRows(recompute);
    const offArchived = subscribeArchived(recompute);
    const offMuted = subscribeMuted(recompute);
    recompute();
    return () => {
      mounted = false;
      offRows();
      offArchived();
      offMuted();
    };
  }, []);

  return total;
}
