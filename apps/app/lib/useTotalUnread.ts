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

/** Sum unread across non-archived rows. A `markedUnread` row with no counted
 *  messages still contributes 1 so the badge mirrors the per-row indicator. */
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
