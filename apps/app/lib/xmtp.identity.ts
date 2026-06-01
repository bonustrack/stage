/** inbox-id → ETH-address resolution + per-conversation member helpers for the
 *  app's XMTP client lib. Extracted from lib/xmtp.ts (phase-2 lint split);
 *  re-exported from there. Cache-first so channel re-summarizes stay under the
 *  XMTP read rate limit. */

import { type Conversation } from '@xmtp/react-native-sdk';
import { getCachedXmtpClient, inboxEthCache } from './xmtp.state';
import { getOrCreateXmtpClient } from './xmtp.client';

/** Batch-resolve inbox ids → ETH address across MANY rows in ONE network call.
 *  Collect every uncached id, fire a single `inboxStates(true, [...])`, prime the
 *  cache, then per-row work can call `resolveInboxEth` (cache hit, zero reads).
 *  Kills the N+1 where each channel row resolved its members serially. Exported
 *  so the channels list can pre-warm the cache before summarising rows. */
export async function primeInboxEthCache(
  client: Awaited<ReturnType<typeof getOrCreateXmtpClient>>,
  ids: string[],
): Promise<void> {
  const missing = [...new Set(ids)].filter(id => id && !inboxEthCache.get(id));
  if (missing.length === 0) return;
  try {
    const states = await client.inboxStates(
      true,
      missing as Parameters<typeof client.inboxStates>[1],
    );
    for (let i = 0; i < missing.length; i++) {
      const eth = states[i]?.identities.find(it => it.kind === 'ETHEREUM');
      if (eth?.identifier) inboxEthCache.set(missing[i]!, eth.identifier);
    }
  } catch { /* best-effort — per-row resolveInboxEth still falls back */ }
}

/** Resolve inbox ids → ETH address, cache-first. Only ids not already cached
 *  hit the network (`inboxStates(true)`); cached ids cost zero reads. */
export async function resolveInboxEth(
  client: Awaited<ReturnType<typeof getOrCreateXmtpClient>>,
  ids: string[],
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const missing: string[] = [];
  for (const id of ids) {
    const cached = inboxEthCache.get(id);
    if (cached) out[id] = cached;
    else missing.push(id);
  }
  if (missing.length > 0) {
    const states = await client.inboxStates(
      true,
      missing as Parameters<typeof client.inboxStates>[1],
    );
    for (let i = 0; i < missing.length; i++) {
      const eth = states[i]?.identities.find(it => it.kind === 'ETHEREUM');
      if (eth?.identifier) {
        out[missing[i]!] = eth.identifier;
        inboxEthCache.set(missing[i]!, eth.identifier);
      }
    }
  }
  return out;
}

/** Resolve the peer's Ethereum address for a DM conversation. Returns null for
 *  groups or when the lookup fails. Cached after the first resolve. */
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

/** Resolve every member of a conversation as a `{inboxId → ethAddress}` map,
 *  INCLUDING the local user. Used by the conversation view to look up the
 *  sender of each message and render their stamp.fyi avatar. */
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

/** Resolve the Ethereum addresses of every member of a group conversation, excluding the
 *  local user's own inbox. Used by the Channels list to render a multi-avatar stack for
 *  group rows. Returns [] for DMs (use `peerEthAddressOfDm` for those) or when the
 *  members lookup fails. */
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
