import { resolveInboxEthCached, primeInboxEthCache } from '@stage-labs/client/xmtp/inboxCache';
import { inboxEthCache } from './xmtp.state.core';

type InboxEthMap = Record<string, string>;

interface IdentityDeps<C extends { inboxId: string | undefined }, V extends { members(): Promise<{ inboxId: string }[]> }> {
  client: () => Promise<C>;
  fetchInboxEth: (client: C) => (ids: string[]) => Promise<InboxEthMap>;
  peerInboxIdOf: (conv: V) => (() => Promise<string>) | null;
  isGroup: (conv: V) => boolean;
}

function warn(where: string, err: unknown): void {
  if (process.env.NODE_ENV !== 'production') console.warn(`${where} failed`, (err as Error).message);
}

export function identityResolvers<C extends { inboxId: string | undefined }, V extends { members(): Promise<{ inboxId: string }[]> }>(
  deps: IdentityDeps<C, V>,
): {
  primeInboxEthCache: (client: C, ids: string[]) => Promise<void>;
  primeConversationMembers: (client: C, convs: V[]) => Promise<void>;
  isGroupConv: (conv: V) => boolean;
  peerEthAddressOfDm: (conv: V) => Promise<string | null>;
  memberInboxToAddressMap: (conv: V) => Promise<InboxEthMap>;
  groupMemberEthAddresses: (conv: V) => Promise<string[]>;
} {
  const resolve = (client: C, ids: string[]): Promise<InboxEthMap> =>
    resolveInboxEthCached(inboxEthCache, deps.fetchInboxEth(client), ids);

  return {
    primeInboxEthCache: (client, ids) => primeInboxEthCache(inboxEthCache, deps.fetchInboxEth(client), ids),

    async primeConversationMembers(client, convs) {
      try {
        const memberLists = await Promise.all(convs.map(c =>
          c.members().then(ms => ms.map(m => m.inboxId)).catch(() => [] as string[]),
        ));
        await primeInboxEthCache(inboxEthCache, deps.fetchInboxEth(client), memberLists.flat());
      } catch { }
    },

    isGroupConv: deps.isGroup,

    async peerEthAddressOfDm(conv) {
      const peerInboxId = deps.peerInboxIdOf(conv);
      if (!peerInboxId) return null;
      try {
        const inboxId = await peerInboxId();
        const map = await resolve(await deps.client(), [inboxId]);
        return map[inboxId] ?? null;
      } catch { return null; }
    },

    async memberInboxToAddressMap(conv) {
      try {
        const members = await conv.members();
        return await resolve(await deps.client(), members.map(m => m.inboxId));
      } catch (err) {
        warn('memberInboxToAddressMap', err);
        return {};
      }
    },

    async groupMemberEthAddresses(conv) {
      if (!deps.isGroup(conv)) return [];
      try {
        const client = await deps.client();
        const otherIds = (await conv.members()).map(m => m.inboxId).filter(id => id !== client.inboxId);
        const map = await resolve(client, otherIds);
        return otherIds.map(id => map[id]).filter((a): a is string => !!a);
      } catch (err) {
        warn('groupMemberEthAddresses', err);
        return [];
      }
    },
  };
}
