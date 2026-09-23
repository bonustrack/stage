import { Dm, Group, type Conversation } from '@xmtp/react-native-sdk';
import { xmtpClient } from './xmtp.client';
import { identityResolvers } from './xmtp.identity.core';

type NativeXmtpClient = Awaited<ReturnType<typeof xmtpClient>>;

export const {
  primeConversationMembers, isGroupConv,
  peerEthAddressOfDm, memberInboxToAddressMap, groupMemberEthAddresses,
} = identityResolvers<NativeXmtpClient, Conversation>({
  client: xmtpClient,
  fetchInboxEth: (client) => async (ids) => {
    const states = await client.inboxStates(true, ids);
    const out: Record<string, string> = {};
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      if (id === undefined) continue;
      const eth = states[i]?.identities.find(it => it.kind === 'ETHEREUM');
      if (eth?.identifier) out[id] = eth.identifier;
    }
    return out;
  },
  peerInboxIdOf: (conv) => (conv instanceof Dm ? () => conv.peerInboxId() : null),
  isGroup: (conv) => conv instanceof Group,
});
