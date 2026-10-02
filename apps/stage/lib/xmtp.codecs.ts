import {
  PublicIdentity,
  ReactionCodec, ReplyCodec, StaticAttachmentCodec, RemoteAttachmentCodec,
  MultiRemoteAttachmentCodec, GroupUpdatedCodec, DeleteMessageCodec,
  type Signer,
} from '@xmtp/react-native-sdk';
import { STAGE_JSON_CODECS, TRANSACTION_REFERENCE_CODEC } from './xmtpJsonCodecs';
import type { AccountRecord } from './accounts';
import { signingKeyForRecord } from './xmtp.signing.core';

export const XMTP_CODECS = [
  new ReactionCodec(),
  new ReplyCodec(),
  new StaticAttachmentCodec(),
  new RemoteAttachmentCodec(),
  new MultiRemoteAttachmentCodec(),
  new GroupUpdatedCodec(),
  new DeleteMessageCodec(),
  ...STAGE_JSON_CODECS,
  TRANSACTION_REFERENCE_CODEC,
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
