
import { IdentifierKind, type Signer } from '@xmtp/browser-sdk';
import { hexToBytes } from 'viem';
import type { PrivateKeyAccount } from 'viem/accounts';
import { PollCodec } from './xmtpPollCodec';
import { SignatureRequestCodec, SignatureReferenceCodec } from './xmtpSignatureCodec';
import { WalletSendCallsCodec, TransactionReferenceCodec } from './xmtpTxCodec';
import { getViemAccount, type AccountRecord } from './accounts';

export const POLL_CODEC = new PollCodec();
export const SIGNATURE_REQUEST_CODEC = new SignatureRequestCodec();
export const SIGNATURE_REFERENCE_CODEC = new SignatureReferenceCodec();
export const WALLET_SEND_CALLS_CODEC = new WalletSendCallsCodec();
export const TRANSACTION_REFERENCE_CODEC = new TransactionReferenceCodec();

export const XMTP_CODECS = [
  POLL_CODEC,
  WALLET_SEND_CALLS_CODEC,
  SIGNATURE_REQUEST_CODEC,
  SIGNATURE_REFERENCE_CODEC,
  TRANSACTION_REFERENCE_CODEC,
];

function signerForAccount(account: PrivateKeyAccount): Signer {
  return {
    type: 'EOA',
    getIdentifier: () => ({
      identifier: account.address.toLowerCase(),
      identifierKind: IdentifierKind.Ethereum,
    }),
    signMessage: async (message: string): Promise<Uint8Array> => {
      const sigHex = await account.signMessage({ message });
      return hexToBytes(sigHex);
    },
  };
}

export async function signerForRecord(rec: AccountRecord): Promise<Signer> {
  if (rec.type === 'smart') return signerForSmart(rec);
  const acct = await getViemAccount(rec.id);
  if (!acct) throw new Error('No signing key for this account.');
  return signerForAccount(acct);
}

async function signerForSmart(rec: AccountRecord): Promise<Signer> {
  if (rec.hdIndex == null) throw new Error('Smart account is missing its HD index.');
  if (rec.scwXmtp === false) {
    const { smartOwnerAddress, signOwnerMessage } = await import('./zerodev/keyring');
    const hdIndex = rec.hdIndex;
    const ownerAddr = await smartOwnerAddress(hdIndex);
    return {
      type: 'EOA',
      getIdentifier: () => ({
        identifier: ownerAddr,
        identifierKind: IdentifierKind.Ethereum,
      }),
      signMessage: async (message: string): Promise<Uint8Array> =>
        hexToBytes(await signOwnerMessage(hdIndex, message)),
    };
  }
  const { kernelClientForRecord } = await import('./zerodev/kernelForRecord');
  const { SCW_CHAIN_ID_BIGINT } = await import('@stage-labs/client/zerodev/config');
  const kernelClient = await kernelClientForRecord(rec);
  return {
    type: 'SCW',
    getIdentifier: () => ({
      identifier: rec.address.toLowerCase(),
      identifierKind: IdentifierKind.Ethereum,
    }),
    getChainId: () => SCW_CHAIN_ID_BIGINT,
    signMessage: async (message: string): Promise<Uint8Array> => hexToBytes(
      await kernelClient.signMessage({ message } as Parameters<typeof kernelClient.signMessage>[0]),
    ),
  };
}
