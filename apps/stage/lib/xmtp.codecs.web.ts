import { IdentifierKind, type Signer } from '@xmtp/browser-sdk';
import { hexToBytes } from 'viem';
import { stageCodecsFor } from '@stage-labs/client/xmtp/contentTypes';
import type { AccountRecord } from './accounts';
import { lazySigningKeyForRecord } from './xmtp.signing.core';

export const XMTP_CODECS = stageCodecsFor('web');

export async function signerForRecord(rec: AccountRecord): Promise<Signer> {
  const key = await lazySigningKeyForRecord(rec);
  const identity = {
    getIdentifier: () => ({ identifier: key.address.toLowerCase(), identifierKind: IdentifierKind.Ethereum }),
    signMessage: async (message: string): Promise<Uint8Array> => hexToBytes(await key.signMessage(message)),
  };
  return key.kind === 'SCW' ? { type: 'SCW', ...identity, getChainId: () => BigInt(key.chainId) } : { type: 'EOA', ...identity };
}
