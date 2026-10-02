import { resolveInboxEthCached, primeInboxEthCache } from '@stage-labs/client/xmtp/inboxCache';
import { inboxEthCache } from './xmtp.state.core';
import { sdk } from './xmtp.sdk';
import { report, recover } from './errorPolicy';

type InboxEthMap = Record<string, string>;
type IdentityClient = Awaited<ReturnType<typeof sdk.client>>;
type IdentityConv = Awaited<ReturnType<typeof sdk.listConvs>>[number];

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

const memberIdsByConv = new WeakMap<IdentityConv, Promise<string[]>>();

function memberIdsOf(conv: IdentityConv): Promise<string[]> {
  const known = memberIdsByConv.get(conv);
  if (known) return known;
  const ids = conv.members().then(ms => ms.map(m => m.inboxId));
  memberIdsByConv.set(conv, ids);
  ids.catch(() => { memberIdsByConv.delete(conv); });
  return ids;
}

export async function primeConversationMembers(client: IdentityClient, convs: IdentityConv[]): Promise<void> {
  try {
    const memberLists = await Promise.all(convs.map(c =>
      memberIdsOf(c).catch(recover<string[]>('xmtp.primeMembers', [])),
    ));
    await primeInboxEthCache(inboxEthCache, fetchInboxEth(client), memberLists.flat());
  } catch (err) {
    report('xmtp.primeMembers', err);
  }
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

export async function inboxEthAddresses(inboxIds: string[]): Promise<InboxEthMap> {
  return resolve(await sdk.client(), inboxIds);
}

export async function memberInboxToAddressMap(conv: IdentityConv): Promise<InboxEthMap> {
  try {
    return await resolve(await sdk.client(), await memberIdsOf(conv));
  } catch (err) {
    report('xmtp.memberInboxToAddressMap', err);
    return {};
  }
}

export async function groupMemberEthAddresses(conv: IdentityConv): Promise<string[]> {
  if (!sdk.isGroup(conv)) return [];
  try {
    const client = await sdk.client();
    const otherIds = (await memberIdsOf(conv)).filter(id => id !== client.inboxId);
    const map = await resolve(client, otherIds);
    return otherIds.map(id => map[id]).filter((a): a is string => !!a);
  } catch (err) {
    report('xmtp.groupMemberEthAddresses', err);
    return [];
  }
}
