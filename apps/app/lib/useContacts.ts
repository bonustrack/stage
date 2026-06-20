
import { useEffect, useMemo, useState } from 'react';
import {
  getCachedRows, subscribeCachedRows, getActiveAccountIdSync,
  type CachedRow,
} from './channelsCache';
import { usePeerProfiles, getPeerName } from './peerProfiles';
import { shortAddress } from './xmtp';

export interface Contact {
  address: string;
  name: string;
}

function peerAddressesFromRows(rows: CachedRow[] | null): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const r of rows ?? []) {
    const peer = typeof r.peerAddress === 'string' ? r.peerAddress : null;
    if (!peer) continue;
    const lower = peer.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    out.push(lower);
  }
  return out;
}

export function useContacts(exclude: string[], query: string): Contact[] {
  const [rows, setRows] = useState<CachedRow[] | null>(() => getCachedRows());
  useEffect(() => subscribeCachedRows(setRows), []);

  const peers = useMemo(() => peerAddressesFromRows(rows), [rows]);
  const version = usePeerProfiles(peers);

  const excludeSet = useMemo(() => {
    const set = new Set(exclude.map(a => a.toLowerCase()));
    const self = getActiveAccountIdSync();
    if (self) set.add(self.toLowerCase());
    return set;
  }, [exclude]);

  const q = query.trim().toLowerCase();

  return useMemo(() => {
    const contacts: Contact[] = peers
      .filter(addr => !excludeSet.has(addr))
      .map(addr => ({
        address: addr,
        name: getPeerName(addr) ?? shortAddress(addr),
      }));
    const filtered = q
      ? contacts.filter(c =>
          c.name.toLowerCase().includes(q) || c.address.includes(q))
      : contacts;
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [peers, excludeSet, q, version]);
}
