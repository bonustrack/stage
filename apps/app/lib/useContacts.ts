/**
 * @file Hook deriving the member-picker contact suggestions — the peers from existing 1:1 DM conversations, read from the account-scoped channelsCache (group rows ignored, no new network calls).
 *  Subscribes to the cache for live updates, fetches peer profiles, and returns a deduped, name-sorted list with the caller's `exclude` set removed and an optional `query` filter applied.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  getCachedRows, subscribeCachedRows, getActiveAccountIdSync,
  type CachedRow,
} from './channelsCache';
import { usePeerProfiles, getPeerName } from './peerProfiles';
import { shortAddress } from './xmtp';

export interface Contact {
  /** Lowercased peer address — the dedupe + exclude key. */
  address: string;
  /** Display name (ENS name from stamp.fyi, else shortened address). */
  name: string;
}

/** Pull the DM-peer addresses out of the cached channel rows. */
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

/**
 * Live list of DM-peer contacts, minus `exclude`, filtered by `query`.
 *
 *  @param exclude addresses to omit (self is always omitted). Case-insensitive.
 *  @param query   case-insensitive filter over name + address; '' shows all.
 */
export function useContacts(exclude: string[], query: string): Contact[] {
  const [rows, setRows] = useState<CachedRow[] | null>(() => getCachedRows());
  useEffect(() => subscribeCachedRows(setRows), []);

  const peers = useMemo(() => peerAddressesFromRows(rows), [rows]);
  /** Fetch (and re-render on) the peers' profiles — name + avatar. */
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
    // `version` is a render-trigger when profiles resolve — intentional dep.
  }, [peers, excludeSet, q, version]);
}
