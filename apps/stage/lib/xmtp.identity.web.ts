import { Dm, Group, IdentifierKind, type Conversation } from '@xmtp/browser-sdk';
import { xmtpClient } from './xmtp.client.web';
import { identityResolvers } from './xmtp.identity.core';

type WebXmtpClient = Awaited<ReturnType<typeof xmtpClient>>;

export const {
  primeInboxEthCache, primeConversationMembers, isGroupConv,
  peerEthAddressOfDm, memberInboxToAddressMap, groupMemberEthAddresses,
} = identityResolvers<WebXmtpClient, Conversation>({
  client: xmtpClient,
  fetchInboxEth: (client) => async (ids) => {
    const states = await client.preferences.getInboxStates(ids);
    const out: Record<string, string> = {};
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      if (id === undefined) continue;
      const eth = states[i]?.accountIdentifiers.find(it => it.identifierKind === IdentifierKind.Ethereum);
      if (eth?.identifier) out[id] = eth.identifier;
    }
    return out;
  },
  peerInboxIdOf: (conv) => (conv instanceof Dm ? () => conv.peerInboxId() : null),
  isGroup: (conv) => conv instanceof Group,
});
