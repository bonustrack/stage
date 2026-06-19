/**
 * @file Hook summing the total unread-message count across all non-archived conversations for the footer badge.
 *  Reuses the existing channelsCache rows (`unreadCount` + `markedUnread`) minus the device-local archived set, subscribing to both so the badge updates live.
 */

import { useEffect, useState } from 'react';
import { getCachedRows, subscribeCachedRows, type CachedRow } from './channelsCache';
import { isArchived, loadArchivedIds, subscribeArchived } from './archived';

/** Sum unread across non-archived rows. A `markedUnread` row with no counted messages still contributes 1 so the badge mirrors the per-row indicator. */
function computeTotal(rows: CachedRow[] | null): number {
  if (!rows) return 0;
  let total = 0;
  for (const r of rows) {
    if (isArchived(r.convId)) continue;
    const count = typeof r.unreadCount === 'number' ? r.unreadCount : 0;
    if (count > 0) total += count;
    else if (r.markedUnread) total += 1;
  }
  return total;
}

/** Live total unread count across all conversations, reactive to cached rows and archived state. */
export function useTotalUnread(): number {
  const [total, setTotal] = useState<number>(() => computeTotal(getCachedRows()));

  useEffect(() => {
    let mounted = true;
    /** Recompute helper. */
    const recompute = (): void => {
      if (mounted) setTotal(computeTotal(getCachedRows()));
    };
    // Ensure the archived set is hydrated, then reconcile once.
    void loadArchivedIds().then(recompute);
    const offRows = subscribeCachedRows(recompute);
    const offArchived = subscribeArchived(recompute);
    recompute();
    return () => {
      mounted = false;
      offRows();
      offArchived();
    };
  }, []);

  return total;
}
