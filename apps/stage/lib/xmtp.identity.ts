import { resolveInboxEthCached, primeInboxEthCache } from '@stage-labs/client/xmtp/inboxCache';
import { inboxEthCache } from './xmtp.state.core';
import { sdk } from './xmtp.sdk';

type InboxEthMap = Record<string, string>;
type IdentityClient = Awaited<ReturnType<typeof sdk.client>>;
type IdentityConv = Awaited<ReturnType<typeof sdk.listConvs>>[number];

function warn(where: string, err: unknown): void {
  if (process.env.NODE_ENV !== 'production') console.warn(`${where} failed`, (err as Error).message);
}

function fetchInboxEth(client: IdentityClient): (ids: string[]) => Promise<InboxEthMap> {
  return async (ids) => {
    const addresses = await sdk.ethAddressesOf(client, ids);
    const out: InboxEthMap = {};
    ids.forEach((id, i) => {
      const eth = addresses[i];
      if (eth) out[id] = eth;
    });
    return out;
  };
}

function resolve(client: IdentityClient, ids: string[]): Promise<InboxEthMap> {
  return resolveInboxEthCached(inboxEthCache, fetchInboxEth(client), ids);
}

export async function primeConversationMembers(client: IdentityClient, convs: IdentityConv[]): Promise<void> {
  try {
    const memberLists = await Promise.all(convs.map(c =>
      c.members().then(ms => ms.map(m => m.inboxId)).catch(() => [] as string[]),
    ));
    await primeInboxEthCache(inboxEthCache, fetchInboxEth(client), memberLists.flat());
  } catch { }
}

export const isGroupConv = sdk.isGroup;

export async function peerEthAddressOfDm(conv: IdentityConv): Promise<string | null> {
  const peerInboxId = sdk.dmPeerInboxId(conv);
  if (!peerInboxId) return null;
  try {
    const inboxId = await peerInboxId();
    const map = await resolve(await sdk.client(), [inboxId]);
    return map[inboxId] ?? null;
  } catch { return null; }
}

export async function memberInboxToAddressMap(conv: IdentityConv): Promise<InboxEthMap> {
  try {
    const members = await conv.members();
    return await resolve(await sdk.client(), members.map(m => m.inboxId));
  } catch (err) {
    warn('memberInboxToAddressMap', err);
    return {};
  }
}

export async function groupMemberEthAddresses(conv: IdentityConv): Promise<string[]> {
  if (!sdk.isGroup(conv)) return [];
  try {
    const client = await sdk.client();
    const otherIds = (await conv.members()).map(m => m.inboxId).filter(id => id !== client.inboxId);
    const map = await resolve(client, otherIds);
    return otherIds.map(id => map[id]).filter((a): a is string => !!a);
  } catch (err) {
    warn('groupMemberEthAddresses', err);
    return [];
  }
}
