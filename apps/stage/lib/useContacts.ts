import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useContactsFocused } from '../components/tabs/useWalletFocused';
import {
  peerEthAddressOfDm, groupMemberEthAddresses, primeConversationMembers, isGroupConv,
  getActiveAccountIdSync, getCachedRows, shortAddress,
} from '../modules/messaging';
import { sdk } from './xmtp.sdk';
import { afterFirstPages } from './feedLines';
import { subscribeCachedRows, type CachedRow } from './channelsCache';
import { usePeerProfiles, getPeerName } from './peerProfiles';

export interface Contact {
  address: string;
  name: string;
}

const NO_ADDRESSES: string[] = [];

function peerAddressesOf(rows: ReturnType<typeof getCachedRows>): string[] {
  const out = new Set<string>();
  for (const r of rows ?? []) {
    const peer = typeof r.peerAddress === 'string' ? r.peerAddress : null;
    if (peer) out.add(peer.toLowerCase());
  }
  return [...out];
}

function toSortedContacts(addresses: string[]): Contact[] {
  return addresses
    .map(address => ({ address, name: getPeerName(address) ?? shortAddress(address) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function seedAddresses(): string[] {
  return peerAddressesOf(getCachedRows());
}

async function collectAddresses(): Promise<string[]> {
  const client = await sdk.client();
  await afterFirstPages();
  const self = (getActiveAccountIdSync() ?? '').toLowerCase();
  const convs = await sdk.listConvs(client, ['allowed']);

  await primeConversationMembers(client, convs);

  const set = new Set<string>();
  await Promise.all(convs.map(async (c) => {
    const addrs = isGroupConv(c)
      ? await groupMemberEthAddresses(c)
      : [await peerEthAddressOfDm(c)].filter((a): a is string => !!a);
    for (const a of addrs) {
      const lower = a.toLowerCase();
      if (lower && lower !== self) set.add(lower);
    }
  }));
  return [...set];
}

export function useContactList(enabled: boolean): Contact[] {
  const { data: addresses = NO_ADDRESSES } = useQuery({
    queryKey: ['allContacts', getActiveAccountIdSync()],
    queryFn: collectAddresses,
    enabled,
    placeholderData: seedAddresses,
  });

  const version = usePeerProfiles(addresses);

  return useMemo(() => toSortedContacts(addresses), [addresses, version]);
}

export function useAllContacts(): { contacts: Contact[] } {
  const contacts = useContactList(useContactsFocused());
  return { contacts };
}

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
