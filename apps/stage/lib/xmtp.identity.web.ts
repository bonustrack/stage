
import { IdentifierKind, type Conversation } from '@xmtp/browser-sdk';
import {
  resolveInboxEthCached, primeInboxEthCache as primeInboxEthCacheRule,
} from '@stage-labs/client/xmtp/inboxCache';
import { getCachedXmtpClient, inboxEthCache } from './xmtp.state.web';
import { getOrCreateXmtpClient } from './xmtp.client.web';

type WebXmtpClient = Awaited<ReturnType<typeof getOrCreateXmtpClient>>;

function inboxEthFetcher(
  client: WebXmtpClient,
): (ids: string[]) => Promise<Record<string, string>> {
  return async (ids) => {
    const states = await client.preferences.getInboxStates(ids);
    const out: Record<string, string> = {};
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      if (id === undefined) continue;
      const eth = states[i]?.accountIdentifiers.find(
        it => it.identifierKind === IdentifierKind.Ethereum,
      );
      if (eth?.identifier) out[id] = eth.identifier;
    }
    return out;
  };
}

export async function primeInboxEthCache(
  client: WebXmtpClient,
  ids: string[],
): Promise<void> {
  await primeInboxEthCacheRule(inboxEthCache, inboxEthFetcher(client), ids);
}

async function resolveInboxEth(
  client: WebXmtpClient,
  ids: string[],
): Promise<Record<string, string>> {
  return await resolveInboxEthCached(inboxEthCache, inboxEthFetcher(client), ids);
}

function peerInboxIdOf(conv: Conversation): (() => Promise<string>) | null {
  const dm = conv as unknown as { peerInboxId?: () => Promise<string> };
  return typeof dm.peerInboxId === 'function' ? dm.peerInboxId.bind(conv) : null;
}

export async function peerEthAddressOfDm(conv: Conversation): Promise<string | null> {
  const peerInboxId = peerInboxIdOf(conv);
  if (!peerInboxId) return null;
  try {
    const inboxId = await peerInboxId();
    const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
    const map = await resolveInboxEth(client, [inboxId]);
    return map[inboxId] ?? null;
  } catch { return null; }
}

export async function memberInboxToAddressMap(conv: Conversation): Promise<Record<string, string>> {
  try {
    const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
    const members = await conv.members();
    const ids = members.map(m => m.inboxId);
    return await resolveInboxEth(client, ids);
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.warn('memberInboxToAddressMap failed', (err as Error).message);
    return {};
  }
}

export async function groupMemberEthAddresses(conv: Conversation): Promise<string[]> {
  if (peerInboxIdOf(conv)) return [];
  try {
    const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
    const members = await conv.members();
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
