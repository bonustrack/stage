
import {
  PublicIdentity,
  ReactionCodec, ReplyCodec, StaticAttachmentCodec, RemoteAttachmentCodec,
  MultiRemoteAttachmentCodec, GroupUpdatedCodec,
  type Signer,
} from '@xmtp/react-native-sdk';
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
];

function signerForAccount(account: PrivateKeyAccount): Signer {
  return {
    getIdentifier: () => Promise.resolve(new PublicIdentity(account.address, 'ETHEREUM')),
    getChainId: () => 1,
    getBlockNumber: () => undefined,
    signerType: () => 'EOA',
    signMessage: async (message: string) => {
      const signature = await account.signMessage({ message });
      return { signature };
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
      getIdentifier: () => Promise.resolve(new PublicIdentity(ownerAddr, 'ETHEREUM')),
      getChainId: () => 1,
      getBlockNumber: () => undefined,
      signerType: () => 'EOA',
      signMessage: async (message: string) => ({ signature: await signOwnerMessage(hdIndex, message) }),
    };
  }
  const { kernelClientForRecord } = await import('./zerodev/kernelForRecord');
  const { scwSigner } = await import('./zerodev/scwSigner');
  const kernelClient = await kernelClientForRecord(rec);
  return scwSigner(kernelClient, rec.address);
}
