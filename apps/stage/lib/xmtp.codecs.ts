import {
  PublicIdentity,
  ReactionCodec,
  ReplyCodec,
  StaticAttachmentCodec,
  RemoteAttachmentCodec,
  MultiRemoteAttachmentCodec,
  GroupUpdatedCodec,
  DeleteMessageCodec,
  type Signer,
} from '@xmtp/react-native-sdk';
import { stageCodecsFor } from '@stage-labs/client/xmtp/contentTypes';
import type { AccountRecord } from '@stage-labs/client/accounts/types';
import { signingKeyForRecord } from './accountSigning';

export const XMTP_CODECS = [
  new ReactionCodec(),
  new ReplyCodec(),
  new StaticAttachmentCodec(),
  new RemoteAttachmentCodec(),
  new MultiRemoteAttachmentCodec(),
  new GroupUpdatedCodec(),
  new DeleteMessageCodec(),
  ...stageCodecsFor('native'),
];

export async function signerForRecord(rec: AccountRecord): Promise<Signer> {
  const key = await signingKeyForRecord(rec);
  return {
    getIdentifier: () => Promise.resolve(new PublicIdentity(key.address, 'ETHEREUM')),
    getChainId: () => key.chainId,
    getBlockNumber: () => undefined,
    signerType: () => key.kind,
    signMessage: async (message: string) => ({ signature: await key.signMessage(message) }),
  };
}
