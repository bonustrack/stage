/** @file Cache-first inbox-id to ETH-address resolution plus per-conversation member helpers for the app's XMTP client lib, keeping channel re-summarizes under the XMTP read rate limit; extracted from lib/xmtp.ts. */

import { type Conversation } from '@xmtp/react-native-sdk';
import {
  resolveInboxEthCached, primeInboxEthCache as primeInboxEthCacheRule,
} from '@stage-labs/client/xmtp/inboxCache';
import { getCachedXmtpClient, inboxEthCache } from './xmtp.state';
import { getOrCreateXmtpClient } from './xmtp.client';

/** The native inbox→eth fetcher for a client: one `inboxStates(true, ids)` call projected to a `{ inboxId → ethAddress }` map — the only part touching the native client; the shared cache-first rule lives in the Stage SDK (@stage-labs/client/xmtp/inboxCache). */
function inboxEthFetcher(
  client: Awaited<ReturnType<typeof getOrCreateXmtpClient>>,
): (ids: string[]) => Promise<Record<string, string>> {
  return async (ids) => {
    const states = await client.inboxStates(
      true,
      ids,
    );
    const out: Record<string, string> = {};
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      if (id === undefined) continue;
      const eth = states[i]?.identities.find(it => it.kind === 'ETHEREUM');
      if (eth?.identifier) out[id] = eth.identifier;
    }
    return out;
  };
}

/** Batch-resolve inbox ids → ETH address across many rows in one network call, pre-warming the shared cache via the SDK rule so per-row `resolveInboxEth` calls hit it (zero reads); kills the N+1 of serial per-row member resolution. */
export async function primeInboxEthCache(
  client: Awaited<ReturnType<typeof getOrCreateXmtpClient>>,
  ids: string[],
): Promise<void> {
  await primeInboxEthCacheRule(inboxEthCache, inboxEthFetcher(client), ids);
}

/** Resolve inbox ids → ETH address, cache-first (SDK rule). Only ids not already cached hit the network (`inboxStates(true)`); cached ids cost zero reads. */
async function resolveInboxEth(
  client: Awaited<ReturnType<typeof getOrCreateXmtpClient>>,
  ids: string[],
): Promise<Record<string, string>> {
  return await resolveInboxEthCached(inboxEthCache, inboxEthFetcher(client), ids);
}

/** Resolve the peer's Ethereum address for a DM conversation. Returns null for groups or when the lookup fails. Cached after the first resolve. */
export async function peerEthAddressOfDm(conv: Conversation): Promise<string | null> {
  /** `version` is 'DM' | 'GROUP'; only DMs have a single peer. */
  if ((conv as unknown as { version?: string }).version !== 'DM') return null;
  const dm = conv as unknown as { peerInboxId: () => Promise<string> };
  try {
    const inboxId = await dm.peerInboxId();
    const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
    const map = await resolveInboxEth(client, [inboxId]);
    return map[inboxId] ?? null;
  } catch { return null; }
}

/** Resolve every member of a conversation as a `{inboxId → ethAddress}` map, INCLUDING the local user. Used by the conversation view to look up the sender of each message and render their stamp.fyi avatar. */
export async function memberInboxToAddressMap(conv: Conversation): Promise<Record<string, string>> {
  try {
    const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
    const members = await (conv as unknown as {
      members: () => Promise<{ inboxId: string }[]>;
    }).members();
    const ids = members.map(m => m.inboxId);
    return await resolveInboxEth(client, ids);
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.warn('memberInboxToAddressMap failed', (err as Error).message);
    return {};
  }
}

/** Resolve the Ethereum addresses of every group member except the local user's own inbox (for the Channels multi-avatar stack); returns [] for DMs (use `peerEthAddressOfDm`) or when the members lookup fails. */
export async function groupMemberEthAddresses(conv: Conversation): Promise<string[]> {
  if ((conv as unknown as { version?: string }).version !== 'GROUP') return [];
  try {
    const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
    const members = await (conv as unknown as {
      members: () => Promise<{ inboxId: string }[]>;
    }).members();
    const otherIds = members
      .map(m => m.inboxId)
      .filter(id => id !== client.inboxId);
    const map = await resolveInboxEth(client, otherIds);
    return otherIds.map(id => map[id]).filter((a): a is string => !!a);
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.warn('groupMemberEthAddresses failed', (err as Error).message);
    return [];
  }
}
