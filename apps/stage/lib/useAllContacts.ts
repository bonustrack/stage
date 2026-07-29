
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { type Conversation } from '@xmtp/react-native-sdk';
import { useContactsFocused } from '../components/tabs/useWalletFocused';
import {
  getCachedXmtpClient, getOrCreateXmtpClient,
  peerEthAddressOfDm, groupMemberEthAddresses, primeInboxEthCache,
  getActiveAccountIdSync, getCachedRows, shortAddress,
} from '../modules/messaging';
import { usePeerProfiles, getPeerName } from './peerProfiles';

export interface Contact {
  address: string;
  name: string;
}

const NO_ADDRESSES: string[] = [];

function seedAddresses(): string[] {
  const out = new Set<string>();
  for (const r of getCachedRows() ?? []) {
    const peer = typeof r.peerAddress === 'string' ? r.peerAddress : null;
    if (peer) out.add(peer.toLowerCase());
  }
  return [...out];
}

async function collectAddresses(): Promise<string[]> {
  const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
  const self = (getActiveAccountIdSync() ?? '').toLowerCase();
  const convs = await client.conversations.list(undefined, undefined, ['allowed']);

  try {
    const memberLists = await Promise.all(convs.map(c =>
      (c as unknown as { members: () => Promise<{ inboxId: string }[]> })
        .members().then(ms => ms.map(m => m.inboxId)).catch(() => [] as string[]),
    ));
    await primeInboxEthCache(client, memberLists.flat());
  } catch { }

  const set = new Set<string>();
  await Promise.all(convs.map(async (c: Conversation) => {
    const isGroup = (c as unknown as { version?: string }).version === 'GROUP';
    const addrs = isGroup
      ? await groupMemberEthAddresses(c)
      : [await peerEthAddressOfDm(c)].filter((a): a is string => !!a);
    for (const a of addrs) {
      const lower = a.toLowerCase();
      if (lower && lower !== self) set.add(lower);
    }
  }));
  return [...set];
}

export function useAllContacts(): { contacts: Contact[]; loading: boolean } {
  const focused = useContactsFocused();
  const { data: addresses = NO_ADDRESSES, isFetched } = useQuery({
    queryKey: ['allContacts', getActiveAccountIdSync()],
    queryFn: collectAddresses,
    enabled: focused,
    placeholderData: seedAddresses,
  });

  const version = usePeerProfiles(addresses);

  const contacts = useMemo(() => {
    return addresses
      .map(address => ({ address, name: getPeerName(address) ?? shortAddress(address) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [addresses, version]);

  return { contacts, loading: !isFetched };
}
