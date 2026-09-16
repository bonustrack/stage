
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { type Conversation } from '@xmtp/react-native-sdk';
import { useContactsFocused } from '../components/tabs/useWalletFocused';
import {
  peerEthAddressOfDm, groupMemberEthAddresses, primeConversationMembers, isGroupConv,
  getActiveAccountIdSync, getCachedRows, shortAddress, xmtpClient,
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
  const client = await xmtpClient();
  const self = (getActiveAccountIdSync() ?? '').toLowerCase();
  const convs = await client.conversations.list(undefined, undefined, ['allowed']);

  await primeConversationMembers(client, convs);

  const set = new Set<string>();
  await Promise.all(convs.map(async (c: Conversation) => {
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
