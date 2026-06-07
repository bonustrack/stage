/** Shared hook for a single synced-appData STRING field on a group (github link,
 *  preview deep link, ...). Seeds from the cached channels row (`field`), keeps in
 *  sync with cache updates, and refreshes off the group's live appData on mount
 *  via `read(line)`. Returns undefined for DMs / unset / read errors. */

import { useEffect, useState } from 'react';
import { useChannelsQuery } from '../../modules/messaging';

export function useCachedGroupString(
  convId: string | undefined,
  activeLine: string,
  isGroup: boolean,
  field: string,
  read: (line: string) => Promise<string | undefined>,
): string | undefined {
  /** Seed from the channels Query (the channelsCache read-mirror) instead of a
   *  bespoke subscribeCachedRows subscription; the row's `field` updates flow
   *  through the same Query entry. */
  const rows = useChannelsQuery();
  const cachedValue = ((): string | undefined => {
    const v = (rows?.find(r => r.convId === convId) as Record<string, unknown> | undefined)?.[field];
    return typeof v === 'string' && v ? v : undefined;
  })();
  /** Live appData read can override the cached seed; once set it wins until the
   *  conv changes. Re-seed from cache whenever the cached value moves. */
  const [fresh, setFresh] = useState<string | undefined>(undefined);
  useEffect(() => {
    setFresh(undefined);
    if (!isGroup) return;
    let cancelled = false;
    void read(activeLine).then(v => { if (!cancelled) setFresh(v); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [convId, activeLine, isGroup]);
  /** Cache is the persisted truth (the live read result is written back to it),
   *  so prefer it when present; the fresh read only fills the gap before the
   *  cache catches up. */
  return cachedValue ?? fresh;
}
