import { type Conversation } from '@xmtp/react-native-sdk';
import { xmtpClient } from './xmtp.client';
import { identityResolvers } from './xmtp.identity.core';

type NativeXmtpClient = Awaited<ReturnType<typeof xmtpClient>>;

const versionOf = (conv: Conversation): string | undefined => (conv as unknown as { version?: string }).version;

export const {
  primeInboxEthCache, peerEthAddressOfDm, memberInboxToAddressMap, groupMemberEthAddresses,
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
  peerInboxIdOf: (conv) => {
    if (versionOf(conv) !== 'DM') return null;
    const dm = conv as unknown as { peerInboxId: () => Promise<string> };
    return () => dm.peerInboxId();
  },
  isGroup: (conv) => versionOf(conv) === 'GROUP',
});
