
import { useEffect, useState } from 'react';
import { isRowCleared, type ClearableRow } from '@stage-labs/client/xmtp/readState';
import { getCachedRows, subscribeCachedRows, type CachedRow } from './channelsCache';
import { getClearedChats, useClearedChats } from './clearedChats';

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

function clearableOf(row: CachedRow): ClearableRow {
  return {
    peerAddress: typeof row.peerAddress === 'string' ? row.peerAddress : null,
    lastTs: numberOrNull(row.lastTs),
    ...(row.lastBubbleTs === undefined ? {} : { lastBubbleTs: numberOrNull(row.lastBubbleTs) }),
  };
}

function computeTotal(rows: CachedRow[] | null): number {
  if (!rows) return 0;
  const cleared = getClearedChats();
  let total = 0;
  for (const r of rows) {
    if (isRowCleared(cleared, clearableOf(r))) continue;
    const count = typeof r.unreadCount === 'number' ? r.unreadCount : 0;
    if (count > 0) total += count;
    else if (r.markedUnread) total += 1;
  }
  return total;
}

export function useTotalUnread(): number {
  const [total, setTotal] = useState<number>(() => computeTotal(getCachedRows()));
  const cleared = useClearedChats();

  useEffect(() => {
    let mounted = true;
    const recompute = (): void => {
      if (mounted) setTotal(computeTotal(getCachedRows()));
    };
    const offRows = subscribeCachedRows(recompute);
    recompute();
    return () => {
      mounted = false;
      offRows();
    };
  }, [cleared]);

  return total;
}
