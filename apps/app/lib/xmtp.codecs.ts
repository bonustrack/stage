/** @file XMTP codec registry (reactions, replies, attachments, polls, signature + transaction codecs) and Signer adapters for the app's XMTP client lib; extracted from lib/xmtp.ts and re-exported there. */

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

/** Shared PollCodec instance — used both in XMTP_CODECS (decode/encode) and by xmtpSendPoll (to pass its contentType to the JS-codec send path). */
export const POLL_CODEC = new PollCodec();
/** Shared signature codec instances — registered in XMTP_CODECS and reused by xmtpSendSignatureRequest / xmtpSendSignatureReference to route through the JS-codec send path (their contentType drives sendEncodedContent). */
export const SIGNATURE_REQUEST_CODEC = new SignatureRequestCodec();
export const SIGNATURE_REFERENCE_CODEC = new SignatureReferenceCodec();
/** Shared transaction codec instances — registered in XMTP_CODECS and reused by xmtpSendTxRequest / xmtpSendTxReference to route through the JS-codec send path (their contentType drives sendEncodedContent). */
export const WALLET_SEND_CALLS_CODEC = new WalletSendCallsCodec();
export const TRANSACTION_REFERENCE_CODEC = new TransactionReferenceCodec();

/** Codecs the local XMTP client decodes inbound and encodes outbound; without them `msg.content()` throws on reaction/reply/attachment payloads and falls back to "[<typeId> payload]" placeholder text, and GroupUpdatedCodec is required for membership/rename system messages to decode at all. */
export const XMTP_CODECS = [
  new ReactionCodec(),
  new ReplyCodec(),
  new StaticAttachmentCodec(),
  new RemoteAttachmentCodec(),
  /** MultiRemoteAttachmentCodec lets one message carry several encrypted-remote attachments; required to encode/decode multi-attachment payloads. Pure-JS registration over the native primitives in @xmtp/react-native-sdk 5.7.0, so no new native dep or dev-client rebuild. */
  new MultiRemoteAttachmentCodec(),
  new GroupUpdatedCodec(),
  /** Metro poll content type `metro.box/poll:1.0` — a pure-JS JSContentCodec (UTF-8 JSON body, no native rebuild) required to encode and decode poll bubbles; votes are plain reactions and need no extra codec. */
  POLL_CODEC,
  /** Metro signature content types `signatureRequest:1.0` (a request to sign EIP-712/personal_sign) and `signatureReference` (the signature posted back) — pure-JS JSContentCodecs (UTF-8 JSON, no native rebuild) required to encode and decode their bubbles. */
  SIGNATURE_REQUEST_CODEC,
  SIGNATURE_REFERENCE_CODEC,
  /** In-chat transactions: WalletSendCalls is a payment REQUEST (EIP-5792 batch) and TransactionReference is the RECEIPT (tx hash) posted back — pure-JS JSContentCodecs (UTF-8 JSON, no native rebuild) required to encode and decode their bubbles. */
  WALLET_SEND_CALLS_CODEC,
  TRANSACTION_REFERENCE_CODEC,
];

/** Build the XMTP-RN `Signer` adapter for a viem `PrivateKeyAccount`; `signMessage` must resolve with `{ signature: hexString }` (passing a viem WalletClient instead surfaces as a "Cannot read property 'raw' of undefined" in the native registration handler). */
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

/** Build the XMTP Signer for an account record: a `smart` (ZeroDev Kernel) account signs via the SCW signer, legacy local-EOA records via their viem key; only needed once at installation registration, as later reads/sends use the on-device installation key. */
export async function signerForRecord(rec: AccountRecord): Promise<Signer> {
  if (rec.type === 'smart') return signerForSmart(rec);
  const acct = await getViemAccount(rec.id);
  if (!acct) throw new Error('No signing key for this account.');
  return signerForAccount(acct);
}

/** XMTP signer for a `smart` (ZeroDev Kernel) account: by default the SCW is the identity, registering its inbox via ERC-1271 (6492-wrapped) on chainId 8453 through the one centralized factory so the chainId matches at every sign; only an explicit `scwXmtp === false` keeps messaging over the mnemonic-derived owner EOA. zerodev modules load lazily. */
async function signerForSmart(rec: AccountRecord): Promise<Signer> {
  if (rec.hdIndex == null) throw new Error('Smart account is missing its HD index.');
  if (rec.scwXmtp === false) {
    /** Legacy account explicitly pinned to the owner EOA identity at hdIndex. The owner address + the signature both come from the keyring (signing in place); no key or mnemonic crosses this boundary. */
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
  /** Default: SCW identity at the Kernel address via the centralized factory. */
  const { kernelClientForRecord } = await import('./zerodev/kernelForRecord');
  const { scwSigner } = await import('./zerodev/scwSigner');
  const kernelClient = await kernelClientForRecord(rec);
  return scwSigner(kernelClient, rec.address);
}
