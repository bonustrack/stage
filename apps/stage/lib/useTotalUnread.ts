
import { useEffect, useState } from 'react';
import { getCachedRows, subscribeCachedRows, type CachedRow } from './channelsCache';

function computeTotal(rows: CachedRow[] | null): number {
  if (!rows) return 0;
  let total = 0;
  for (const r of rows) {
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
    const offRows = subscribeCachedRows(recompute);
    recompute();
    return () => {
      mounted = false;
      offRows();
    };
  }, []);

  return total;
}
