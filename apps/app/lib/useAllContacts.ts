/** @file Hook deriving the full Contacts-page list (every DM peer plus every group member, deduped by address, self excluded) by walking the live XMTP conversation list non-blocking over the cached seed and resolving names/avatars via peerProfiles, returning the name-sorted list with a `loading` flag. */

import { useEffect, useMemo, useState } from 'react';
import { type Conversation } from '@xmtp/react-native-sdk';
import { useContactsFocused } from '../components/tabs/useWalletFocused';
import {
  getCachedXmtpClient, getOrCreateXmtpClient,
  peerEthAddressOfDm, groupMemberEthAddresses, primeInboxEthCache,
  getActiveAccountIdSync, getCachedRows, shortAddress,
} from '../modules/messaging';
import { usePeerProfiles, getPeerName } from './peerProfiles';

export interface Contact {
  /** Lowercased peer address — the dedupe key. */
  address: string;
  /** Display name (stamp.fyi name, else shortened address). */
  name: string;
}

/** Seed from the cached channel rows so the page paints DM peers instantly, before the live group-member walk completes. */
function seedAddresses(): string[] {
  const out = new Set<string>();
  for (const r of getCachedRows() ?? []) {
    const peer = typeof r.peerAddress === 'string' ? r.peerAddress : null;
    if (peer) out.add(peer.toLowerCase());
  }
  return [...out];
}

/** Walk every accepted conversation, collecting unique member addresses: the peer for DMs, all other members for groups. Self is excluded. */
async function collectAddresses(): Promise<string[]> {
  const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
  const self = (getActiveAccountIdSync() ?? '').toLowerCase();
  const convs = await client.conversations.list(undefined, undefined, ['allowed']);

  /** Prime the inbox→eth cache for every member across all convs in ONE network call (mirrors HomeScreen.sync) so the per-conv resolves below are cache hits and stay under the XMTP read rate limit. */
  try {
    const memberLists = await Promise.all(convs.map(c =>
      (c as unknown as { members: () => Promise<{ inboxId: string }[]> })
        .members().then(ms => ms.map(m => m.inboxId)).catch(() => [] as string[]),
    ));
    await primeInboxEthCache(client, memberLists.flat());
  } catch { /* per-conv resolve still falls back */ }

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

/** Live, deduped contact list (DM peers + group members), name-sorted. */
export function useAllContacts(): { contacts: Contact[]; loading: boolean } {
  const [addresses, setAddresses] = useState<string[]>(() => seedAddresses());
  const [loading, setLoading] = useState(true);

  /** FOCUS GATE: the Contacts tab body mounts at app boot (pager mounts all tabs side-by-side), so latch on first Contacts focus to avoid running the conversation walk + primeInboxEthCache on every cold start (which duplicated HomeScreen.sync's member walk). */
  const focused = useContactsFocused();

  useEffect(() => {
    if (!focused) return;
    let cancelled = false;
    void (async (): Promise<void> => {
      try {
        const addrs = await collectAddresses();
        if (!cancelled) setAddresses(addrs);
      } catch { /* keep the seed */ } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [focused]);

  /** Re-render as profiles resolve; `version` is the render trigger. */
  const version = usePeerProfiles(addresses);

  const contacts = useMemo(() => {
    return addresses
      .map(address => ({ address, name: getPeerName(address) ?? shortAddress(address) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    /** `version` is intentional: re-sort/re-label when names resolve. */
  }, [addresses, version]);

  return { contacts, loading };
}
