/** XMTP codec registry + Signer adapters for the app's XMTP client lib.
 *  Extracted from lib/xmtp.ts (phase-2 lint split); re-exported from there. */

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
import { ChannelPrefsCodec } from './xmtpChannelPrefsCodec';
import { getViemAccount, type AccountRecord } from './accounts';
import { getWcSign } from './wcSigner';

/** Shared PollCodec instance — used both in XMTP_CODECS (decode/encode) and by
 *  xmtpSendPoll (to pass its contentType to the JS-codec send path). */
export const POLL_CODEC = new PollCodec();
/** Shared signature codec instances — registered in XMTP_CODECS and reused
 *  by xmtpSendSignatureRequest / xmtpSendSignatureReference to route through
 *  the JS-codec send path (their contentType drives sendEncodedContent). */
export const SIGNATURE_REQUEST_CODEC = new SignatureRequestCodec();
export const SIGNATURE_REFERENCE_CODEC = new SignatureReferenceCodec();
/** Shared transaction codec instances — registered in XMTP_CODECS and reused
 *  by xmtpSendTxRequest / xmtpSendTxReference to route through the JS-codec
 *  send path (their contentType drives sendEncodedContent). */
export const WALLET_SEND_CALLS_CODEC = new WalletSendCallsCodec();
export const TRANSACTION_REFERENCE_CODEC = new TransactionReferenceCodec();
/** Shared channel-prefs codec instance — registered in XMTP_CODECS and reused by
 *  lib/channelPrefsSync.ts to route delta/snapshot sends through the JS-codec
 *  send path (its contentType drives conv.send). */
export const CHANNEL_PREFS_CODEC = new ChannelPrefsCodec();

/** Codecs the local XMTP client decodes inbound + uses to encode outbound. Without these
 *  the RN SDK's `msg.content()` throws on reaction/reply/attachment payloads and we fall
 *  back to "[<typeId> payload]" placeholder text — that's why Less saw "[reaction payload]"
 *  instead of "[react 👍]" on his own outbound bubbles. GroupUpdatedCodec is required for
 *  membership/rename system messages to decode at all. */
export const XMTP_CODECS = [
  new ReactionCodec(),
  new ReplyCodec(),
  new StaticAttachmentCodec(),
  new RemoteAttachmentCodec(),
  /** MultiRemoteAttachmentCodec lets one message carry several encrypted-remote
   *  attachments (`xmtp.org/multiRemoteStaticAttachment`). Without it registered,
   *  `msg.content()` throws on inbound multi-attachment payloads and we'd fall
   *  back to the "[…payload]" placeholder; on outbound it's needed so
   *  `conv.send({ multiRemoteAttachment })` encodes. Pure JS registration — the
   *  native module (already in @xmtp/react-native-sdk 5.7.0) supplies the
   *  encrypt/decrypt primitives, so no new native dep / dev-client rebuild. */
  new MultiRemoteAttachmentCodec(),
  new GroupUpdatedCodec(),
  /** Metro poll content type `metro.box/poll:1.0`. Pure-JS JSContentCodec — the
   *  poll body is UTF-8 JSON bytes inside an EncodedContent, so no native module
   *  / dev-client rebuild. Required on both encode (xmtpSendPoll) and decode
   *  (inbound poll bubbles) — without it msg.content() throws and we fall back
   *  to the "[poll payload]" placeholder. Votes are plain reactions (see
   *  xmtpVote) and need no extra codec. */
  POLL_CODEC,
  /** Metro signature content types `metro.box/signatureRequest:1.0` (a request
   *  to sign EIP-712 typed data or a personal_sign string) + `signatureReference`
   *  (the signature posted back). Pure-JS JSContentCodecs (UTF-8 JSON bodies) — no
   *  native module / dev-client rebuild. Required on both encode
   *  (xmtpSendSignatureRequest/Reference) and decode (inbound bubbles) — without
   *  them msg.content() throws and we fall back to the "[…payload]" placeholder. */
  SIGNATURE_REQUEST_CODEC,
  SIGNATURE_REFERENCE_CODEC,
  /** In-chat transactions. WalletSendCalls = a payment REQUEST (EIP-5792
   *  wallet_sendCalls batch); TransactionReference = the RECEIPT (tx hash)
   *  posted back after the payer broadcasts. Pure-JS JSContentCodecs (UTF-8
   *  JSON bodies) — no native module / dev-client rebuild. Required on both
   *  encode (xmtpSendTxRequest/Reference) and decode (inbound tx bubbles) —
   *  without them msg.content() throws and we fall back to the "[…payload]"
   *  placeholder. */
  WALLET_SEND_CALLS_CODEC,
  TRANSACTION_REFERENCE_CODEC,
  /** Stage channel-preferences sync `stage.app/channel-prefs:1.0`. Pure-JS
   *  JSContentCodec (UTF-8 JSON body) — no native module / dev-client rebuild.
   *  Registered so the self-group's delta/snapshot messages decode on inbound
   *  (boot fold + live stream) and encode on outbound. */
  CHANNEL_PREFS_CODEC,
];

/** Build the XMTP-RN `Signer` adapter for a viem `PrivateKeyAccount`.
 *  Shape pulled from `node_modules/@xmtp/react-native-sdk/src/lib/Signer.ts`:
 *  `getIdentifier / getChainId / getBlockNumber / signerType / signMessage`.
 *  `signMessage` resolves with `{ signature: hexString }` — passing a
 *  viem WalletClient instead surfaces as "Cannot read property 'raw' of
 *  undefined" inside the native registration handler. */
function signerForAccount(account: PrivateKeyAccount): Signer {
  return {
    getIdentifier: async () => new PublicIdentity(account.address, 'ETHEREUM'),
    getChainId: () => 1,
    getBlockNumber: () => undefined,
    signerType: () => 'EOA',
    signMessage: async (message: string) => {
      const signature = await account.signMessage({ message });
      return { signature };
    },
  };
}

/** Build the XMTP Signer for an account record. Local accounts (generated /
 *  imported) sign silently with their viem key; WalletConnect accounts would
 *  delegate to the connected wallet — only ever needed once, at installation
 *  registration (Client.create). Reads + sends afterwards use the on-device
 *  installation key, so a registered account never re-prompts the wallet. */
export async function signerForRecord(rec: AccountRecord): Promise<Signer> {
  if (rec.type === 'walletconnect') {
    const wcSign = getWcSign();
    if (!wcSign) throw new Error('Reconnect your wallet to finish setting up this account.');
    return {
      getIdentifier: async () => new PublicIdentity(rec.address, 'ETHEREUM'),
      getChainId: () => 1,
      getBlockNumber: () => undefined,
      signerType: () => 'EOA',
      signMessage: async (message: string) => {
        /** Routes to the connected wallet via WalletConnect (personal_sign).
         *  Only invoked once — when registering this account's XMTP installation. */
        const signature = await wcSign(message);
        return { signature };
      },
    };
  }
  const acct = await getViemAccount(rec.id);
  if (!acct) throw new Error('No signing key for this account.');
  return signerForAccount(acct);
}
