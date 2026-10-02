import { IdentifierKind, type Signer } from '@xmtp/browser-sdk';
import { hexToBytes } from 'viem';
import { DELETE_MESSAGE_CODEC } from '@stage-labs/client/xmtp/deleteMessage';
import { STAGE_JSON_CODECS } from '@stage-labs/client/xmtp/jsonCodecs';
import type { AccountRecord } from './accounts';
import { lazySigningKeyForRecord } from './xmtp.signing.core';

export const XMTP_CODECS = [...STAGE_JSON_CODECS, DELETE_MESSAGE_CODEC];

export async function signerForRecord(rec: AccountRecord): Promise<Signer> {
  const key = await lazySigningKeyForRecord(rec);
  const identity = {
    getIdentifier: () => ({ identifier: key.address.toLowerCase(), identifierKind: IdentifierKind.Ethereum }),
    signMessage: async (message: string): Promise<Uint8Array> => hexToBytes(await key.signMessage(message)),
  };
  return key.kind === 'SCW'
    ? { type: 'SCW', ...identity, getChainId: () => BigInt(key.chainId) }
    : { type: 'EOA', ...identity };
}
