/** @file Shared hook for a single synced-appData string field on a group (e.g. github link, preview deep link) that seeds from the cached channels row, tracks cache updates, and refreshes from live appData on mount. */

import { useEffect, useState } from 'react';
import { getCachedRows, subscribeCachedRows } from '../../modules/messaging';

/** Provides a cached group metadata string, refreshing it from storage on change. */
export function useCachedGroupString(
  convId: string | undefined,
  activeLine: string,
  isGroup: boolean,
  field: string,
  read: (line: string) => Promise<string | undefined>,
): string | undefined {
  /** Cached helper. */
  const cached = (cid?: string): string | undefined => {
    const v = (getCachedRows()?.find(r => r.convId === cid) as Record<string, unknown> | undefined)?.[field];
    return typeof v === 'string' && v ? v : undefined;
  };
  const [value, setValue] = useState<string | undefined>(() => cached(convId));
  useEffect(() => {
    /** Apply helper. */
    const apply = (): void => { setValue(cached(convId)); };
    apply();
    const unsub = subscribeCachedRows(apply);
    let cancelled = false;
    if (isGroup) void read(activeLine).then(v => { if (!cancelled) setValue(v); }).catch(() => undefined);
    return () => { cancelled = true; unsub(); };
  }, [convId, activeLine, isGroup]);
  return value;
}
