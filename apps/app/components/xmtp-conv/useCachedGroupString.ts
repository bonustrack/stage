/** Shared hook for a single synced-appData STRING field on a group (github link,
 *  preview deep link, ...). Seeds from the cached channels row (`field`), keeps in
 *  sync with cache updates, and refreshes off the group's live appData on mount
 *  via `read(line)`. Returns undefined for DMs / unset / read errors. */

import { useEffect, useState } from 'react';
import { getCachedRows, subscribeCachedRows } from '../../modules/messaging';

export function useCachedGroupString(
  convId: string | undefined,
  activeLine: string,
  isGroup: boolean,
  field: string,
  read: (line: string) => Promise<string | undefined>,
): string | undefined {
  const cached = (cid?: string): string | undefined => {
    const v = (getCachedRows()?.find(r => r.convId === cid) as Record<string, unknown> | undefined)?.[field];
    return typeof v === 'string' && v ? v : undefined;
  };
  const [value, setValue] = useState<string | undefined>(() => cached(convId));
  useEffect(() => {
    const apply = (): void => setValue(cached(convId));
    apply();
    const unsub = subscribeCachedRows(apply);
    let cancelled = false;
    if (isGroup) void read(activeLine).then(v => { if (!cancelled) setValue(v); }).catch(() => undefined);
    return () => { cancelled = true; unsub(); };
  }, [convId, activeLine, isGroup]);
  return value;
}
