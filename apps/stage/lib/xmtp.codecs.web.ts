import { IdentifierKind, type Signer } from '@xmtp/browser-sdk';
import { hexToBytes } from 'viem';
import {
  POLL_CODEC, SIGNATURE_REQUEST_CODEC, SIGNATURE_REFERENCE_CODEC, WALLET_SEND_CALLS_CODEC,
  READ_STATE_CODEC, PIN_STATE_CODEC, CLEAR_STATE_CODEC,
} from './xmtpJsonCodecs';
import type { AccountRecord } from './accounts';
import { lazySigningKeyForRecord } from './xmtp.signing.core';

export const XMTP_CODECS = [
  POLL_CODEC,
  WALLET_SEND_CALLS_CODEC,
  SIGNATURE_REQUEST_CODEC,
  SIGNATURE_REFERENCE_CODEC,
  READ_STATE_CODEC,
  PIN_STATE_CODEC,
  CLEAR_STATE_CODEC,
];

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
