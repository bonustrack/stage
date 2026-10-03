import { resolveInboxEthCached, primeInboxEthCache } from '@stage-labs/client/xmtp/inboxCache';
import { inboxEthCache } from './xmtp.state.core';
import { sdk } from './xmtp.sdk';
import { ignored, report, recover } from './errorPolicy';

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

export async function inboxEthAddresses(inboxIds: string[]): Promise<InboxEthMap> {
  return resolve(await sdk.client(), inboxIds);
}

export interface ConvMembers {
  peerAddress: string | null;
  inboxToAddr: InboxEthMap;
  otherAddresses: string[];
}

const NO_MEMBERS: ConvMembers = { peerAddress: null, inboxToAddr: {}, otherAddresses: [] };

function peerInboxIdOf(conv: IdentityConv): Promise<string | null> {
  const peerInboxId = sdk.dmPeerInboxId(conv);
  return peerInboxId ? peerInboxId().catch(ignored<string | null>(null, 'optional')) : Promise.resolve(null);
}

export async function convMembers(conv: IdentityConv): Promise<ConvMembers> {
  try {
    const client = await sdk.client();
    const [peerId, memberIds] = await Promise.all([
      peerInboxIdOf(conv),
      memberIdsOf(conv).catch(recover<string[]>('xmtp.convMembers', [])),
    ]);
    const found = await resolve(client, peerId ? [...memberIds, peerId] : memberIds);
    const inboxToAddr: InboxEthMap = {};
    for (const id of memberIds) {
      const addr = found[id];
      if (addr) inboxToAddr[id] = addr;
    }
    const otherAddresses = sdk.isGroup(conv)
      ? memberIds.filter(id => id !== client.inboxId).map(id => found[id]).filter((a): a is string => !!a)
      : [];
    return { peerAddress: peerId ? found[peerId] ?? null : null, inboxToAddr, otherAddresses };
  } catch (err) {
    report('xmtp.convMembers', err);
    return NO_MEMBERS;
  }
}
