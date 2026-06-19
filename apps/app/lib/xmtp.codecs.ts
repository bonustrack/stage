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

/**
 * Codecs the local XMTP client decodes inbound + uses to encode outbound. Without these
 *  the RN SDK's `msg.content()` throws on reaction/reply/attachment payloads and we fall
 *  back to "[<typeId> payload]" placeholder text — that's why Less saw "[reaction payload]"
 *  instead of "[react 👍]" on his own outbound bubbles. GroupUpdatedCodec is required for
 *  membership/rename system messages to decode at all.
 */
export const XMTP_CODECS = [
  new ReactionCodec(),
  new ReplyCodec(),
  new StaticAttachmentCodec(),
  new RemoteAttachmentCodec(),
  /**
   * MultiRemoteAttachmentCodec lets one message carry several encrypted-remote
   *  attachments (`xmtp.org/multiRemoteStaticAttachment`). Without it registered,
   *  `msg.content()` throws on inbound multi-attachment payloads and we'd fall
   *  back to the "[…payload]" placeholder; on outbound it's needed so
   *  `conv.send({ multiRemoteAttachment })` encodes. Pure JS registration — the
   *  native module (already in @xmtp/react-native-sdk 5.7.0) supplies the
   *  encrypt/decrypt primitives, so no new native dep / dev-client rebuild.
   */
  new MultiRemoteAttachmentCodec(),
  new GroupUpdatedCodec(),
  /**
   * Metro poll content type `metro.box/poll:1.0`. Pure-JS JSContentCodec — the
   *  poll body is UTF-8 JSON bytes inside an EncodedContent, so no native module
   *  / dev-client rebuild. Required on both encode (xmtpSendPoll) and decode
   *  (inbound poll bubbles) — without it msg.content() throws and we fall back
   *  to the "[poll payload]" placeholder. Votes are plain reactions (see
   *  xmtpVote) and need no extra codec.
   */
  POLL_CODEC,
  /**
   * Metro signature content types `metro.box/signatureRequest:1.0` (a request
   *  to sign EIP-712 typed data or a personal_sign string) + `signatureReference`
   *  (the signature posted back). Pure-JS JSContentCodecs (UTF-8 JSON bodies) — no
   *  native module / dev-client rebuild. Required on both encode
   *  (xmtpSendSignatureRequest/Reference) and decode (inbound bubbles) — without
   *  them msg.content() throws and we fall back to the "[…payload]" placeholder.
   */
  SIGNATURE_REQUEST_CODEC,
  SIGNATURE_REFERENCE_CODEC,
  /**
   * In-chat transactions. WalletSendCalls = a payment REQUEST (EIP-5792
   *  wallet_sendCalls batch); TransactionReference = the RECEIPT (tx hash)
   *  posted back after the payer broadcasts. Pure-JS JSContentCodecs (UTF-8
   *  JSON bodies) — no native module / dev-client rebuild. Required on both
   *  encode (xmtpSendTxRequest/Reference) and decode (inbound tx bubbles) —
   *  without them msg.content() throws and we fall back to the "[…payload]"
   *  placeholder.
   */
  WALLET_SEND_CALLS_CODEC,
  TRANSACTION_REFERENCE_CODEC,
];

/**
 * Build the XMTP-RN `Signer` adapter for a viem `PrivateKeyAccount`.
 *  Shape pulled from `node_modules/@xmtp/react-native-sdk/src/lib/Signer.ts`:
 *  `getIdentifier / getChainId / getBlockNumber / signerType / signMessage`.
 *  `signMessage` resolves with `{ signature: hexString }` — passing a
 *  viem WalletClient instead surfaces as "Cannot read property 'raw' of
 *  undefined" inside the native registration handler.
 */
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

/**
 * Build the XMTP Signer for an account record. A `smart` (ZeroDev Kernel)
 *  account signs via the SCW signer; legacy local-EOA records sign silently with
 *  their viem key. Only ever needed once, at installation registration
 *  (Client.create) — reads + sends afterwards use the on-device installation key.
 */
export async function signerForRecord(rec: AccountRecord): Promise<Signer> {
  if (rec.type === 'smart') return signerForSmart(rec);
  const acct = await getViemAccount(rec.id);
  if (!acct) throw new Error('No signing key for this account.');
  return signerForAccount(acct);
}

/**
 * XMTP signer for a `smart` (ZeroDev Kernel) account.
 *
 *  DEFAULT (Less): the SMART ACCOUNT is the XMTP identity. The Kernel address
 *  registers its inbox via ERC-1271 (6492-wrapped while the Kernel is still
 *  counterfactual / undeployed), chainId 8453 — built through the ONE centralized
 *  factory (lib/zerodev/scwSigner) so the chainId is identical at registration
 *  and every later sign (else AssociationError.ChainIdMismatch).
 *
 *  LEGACY ESCAPE HATCH: only when `rec.scwXmtp === false` is set EXPLICITLY (an
 *  account minted under the pre-flip default) do we keep messaging over the
 *  mnemonic-derived OWNER EOA so its existing inbox isn't disrupted. A new account
 *  (scwXmtp === true) or any record with the flag UNSET defaults to the SCW
 *  identity — a fresh inbox at the SCW address, which is expected/accepted.
 *
 *  zerodev modules are imported LAZILY so the XMTP module graph doesn't pull the
 *  Kernel SDK unless a smart account is actually signed.
 */
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
