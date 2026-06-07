/** Total unread-message count across all non-archived conversations.
 *
 *  Reuses the EXISTING unread mechanism: the per-account `channelsCache` rows
 *  (each carries `unreadCount` + `markedUnread`, maintained by the live stream
 *  and cleared on read) and the device-local `archived` set. We do NOT invent a
 *  new counter; we just sum what the Channels list already tracks.
 *
 *  Live: reads the channels list through `useChannelsQuery` (the TanStack-Query
 *  read-mirror of channelsCache - new inbound bumps a row's count, reading a
 *  conv clears it, account switch swaps the row set) and subscribes to
 *  `subscribeArchived` (archiving a conv removes it from the total), so the
 *  footer badge updates the instant the count changes. */

import { useEffect, useMemo, useState } from 'react';
import { type CachedRow } from './channelsCache';
import { useChannelsQuery } from '../modules/messaging/channelsQuery';
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

export function useTotalUnread(): number {
  /** Rows come from the channels Query (the channelsCache read-mirror); we no
   *  longer wire a bespoke subscribeCachedRows here. */
  const rows = useChannelsQuery();
  /** Archive state is device-local (not in channelsCache), so it keeps its own
   *  subscription. Bump a nonce on every archive change so the memo recomputes
   *  the total the instant `isArchived` flips. */
  const [archiveNonce, setArchiveNonce] = useState(0);
  useEffect(() => {
    void loadArchivedIds().then(() => setArchiveNonce(n => n + 1));
    return subscribeArchived(() => setArchiveNonce(n => n + 1));
  }, []);

  return useMemo(() => computeTotal(rows), [rows, archiveNonce]);
}
