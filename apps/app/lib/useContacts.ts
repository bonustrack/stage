/** Derives the user's "contacts" — the peers from their existing 1:1 DM
 *  conversations — for the member-picker suggestion list.
 *
 *  Source: the account-scoped `channelsCache` rows that the Channels screen
 *  already loads + persists. Each DM row carries `peerAddress` (the resolved
 *  peer eth address) + `title`; group rows have `peerAddress === null` and are
 *  ignored. No new network calls — we reuse data that's already in memory.
 *
 *  The hook subscribes to the cache so the suggestions stay live, fetches the
 *  peers' Snapshot profiles (name/avatar) via the shared `peerProfiles` cache,
 *  and returns a deduplicated, name-sorted contact list with the caller's
 *  `exclude` set (self, already-staged members, current group members) removed
 *  and an optional case-insensitive `query` filter applied. */

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

/** Live list of DM-peer contacts, minus `exclude`, filtered by `query`.
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
