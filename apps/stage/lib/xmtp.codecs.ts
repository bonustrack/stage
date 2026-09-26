import {
  PublicIdentity,
  ReactionCodec, ReplyCodec, StaticAttachmentCodec, RemoteAttachmentCodec,
  MultiRemoteAttachmentCodec, GroupUpdatedCodec,
  type Signer,
} from '@xmtp/react-native-sdk';
import {
  POLL_CODEC, SIGNATURE_REQUEST_CODEC, SIGNATURE_REFERENCE_CODEC,
  WALLET_SEND_CALLS_CODEC, TRANSACTION_REFERENCE_CODEC, READ_STATE_CODEC, PIN_STATE_CODEC, CLEAR_STATE_CODEC,
  BOARD_STATE_CODEC, LABEL_STATE_CODEC, SYNC_SNAPSHOT_CODEC,
} from './xmtpJsonCodecs';
import type { AccountRecord } from './accounts';
import { signingKeyForRecord } from './xmtp.signing.core';

export const XMTP_CODECS = [
  new ReactionCodec(),
  new ReplyCodec(),
  new StaticAttachmentCodec(),
  new RemoteAttachmentCodec(),
  new MultiRemoteAttachmentCodec(),
  new GroupUpdatedCodec(),
  POLL_CODEC,
  SIGNATURE_REQUEST_CODEC,
  SIGNATURE_REFERENCE_CODEC,
  WALLET_SEND_CALLS_CODEC,
  TRANSACTION_REFERENCE_CODEC,
  READ_STATE_CODEC,
  PIN_STATE_CODEC,
  CLEAR_STATE_CODEC,
  BOARD_STATE_CODEC,
  LABEL_STATE_CODEC,
  SYNC_SNAPSHOT_CODEC,
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
