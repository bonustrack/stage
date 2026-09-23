
import { useEffect, useMemo, useState } from 'react';
import {
  getCachedRows, subscribeCachedRows, getActiveAccountIdSync,
  type CachedRow,
} from './channelsCache';
import { usePeerProfiles } from './peerProfiles';
import { peerAddressesOf, toSortedContacts, type Contact } from './useAllContacts';

export type { Contact };

export function useContacts(exclude: string[], query: string): Contact[] {
  const [rows, setRows] = useState<CachedRow[] | null>(() => getCachedRows());
  useEffect(() => subscribeCachedRows(setRows), []);

  const peers = useMemo(() => peerAddressesOf(rows), [rows]);
  const version = usePeerProfiles(peers);

  const excludeSet = useMemo(() => {
    const set = new Set(exclude.map(a => a.toLowerCase()));
    const self = getActiveAccountIdSync();
    if (self) set.add(self.toLowerCase());
    return set;
  }, [exclude]);

  const q = query.trim().toLowerCase();

  return useMemo(() => {
    const contacts = toSortedContacts(peers.filter(addr => !excludeSet.has(addr)));
    return q
      ? contacts.filter(c => c.name.toLowerCase().includes(q) || c.address.includes(q))
      : contacts;
  }, [peers, excludeSet, q, version]);
}
