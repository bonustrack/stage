/**
 * @file Resolvers mapping XMTP conversation membership to Ethereum addresses (DM peer, group members, inbox-id map).
 */
/** Conversation-membership resolvers — peer eth address (DMs), group member eth addresses, inbox-id → eth-address map. Pulled out of `xmtp.ts` so that file stays under the per-file LOC cap. */

import { IdentifierKind, type Conversation } from '@xmtp/browser-sdk';
import { getCachedXmtpClient, getOrCreateXmtpClient } from './xmtp';

/** Resolve the peer's Ethereum address for a DM conversation. Returns null for groups or when the lookup fails. */
export async function peerEthAddressOfDm(conv: Conversation): Promise<string | null> {
  /** DMs expose `peerInboxId()`; groups don't. */
  const dm = conv as unknown as { peerInboxId?: () => Promise<string> };
  if (typeof dm.peerInboxId !== 'function') return null;
  try {
    const inboxId = await dm.peerInboxId();
    const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
    const states = await client.preferences.getInboxStates([inboxId]);
    const eth = states[0]?.accountIdentifiers.find(i => i.identifierKind === IdentifierKind.Ethereum);
    return eth?.identifier ?? null;
  } catch { return null; }
}

/** Group member eth addresses, excluding the local user's own inbox. [] for DMs. */
export async function groupMemberEthAddresses(conv: Conversation): Promise<string[]> {
  if (typeof (conv as unknown as { peerInboxId?: unknown }).peerInboxId === 'function') return [];
  try {
    const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
    const members = await conv.members();
    const otherIds = members.map(m => m.inboxId).filter(id => id !== client.inboxId);
    if (otherIds.length === 0) return [];
    const states = await client.preferences.getInboxStates(otherIds);
    const addrs: string[] = [];
    for (const s of states) {
      const eth = s.accountIdentifiers.find(i => i.identifierKind === IdentifierKind.Ethereum);
      if (eth?.identifier) addrs.push(eth.identifier);
    }
    return addrs;
  } catch { return []; }
}

/** Map every member inbox id of a conversation to its Ethereum address. Includes the local user. */
export async function memberInboxToAddressMap(conv: Conversation): Promise<Record<string, string>> {
  try {
    const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
    const members = await conv.members();
    const ids = members.map(m => m.inboxId);
    if (ids.length === 0) return {};
    const states = await client.preferences.getInboxStates(ids);
    const map: Record<string, string> = {};
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      if (id === undefined) continue;
      const eth = states[i]?.accountIdentifiers.find(it => it.identifierKind === IdentifierKind.Ethereum);
      if (eth?.identifier) map[id] = eth.identifier;
    }
    return map;
  } catch { return {}; }
}
