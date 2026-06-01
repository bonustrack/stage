/** XMTP send helpers for the app's XMTP client lib. Extracted from lib/xmtp.ts
 *  (phase-2 lint split); re-exported from there. The decoded-message → envelope
 *  mapper lives in xmtp.envelope.ts and is re-exported here for back-compat. */

import {
  type ReactionContent, type ReplyContent, type StaticAttachmentContent,
} from '@xmtp/react-native-sdk';
import { type PollContent } from '@metro-labs/client/xmtp/poll';
import {
  type SignatureRequestContent, type SignatureReferenceContent,
} from '@metro-labs/client/xmtp/sign';
import {
  type WalletSendCallsContent, type TransactionReferenceContent,
} from '@metro-labs/client/xmtp/tx';
import { convOfLine } from './xmtp.client';
import {
  POLL_CODEC, SIGNATURE_REQUEST_CODEC, SIGNATURE_REFERENCE_CODEC,
  WALLET_SEND_CALLS_CODEC, TRANSACTION_REFERENCE_CODEC,
} from './xmtp.codecs';

export { envelopeOfXmtpMessage } from './xmtp.envelope';

/** Send a plain-text XMTP message. Returns the message id. */
export async function xmtpSendText(line: string, text: string): Promise<string> {
  const conv = await convOfLine(line);
  if (!conv) throw new Error(`XMTP conversation not found: ${line}`);
  return await conv.send(text);
}

/** Send an XMTP reaction (action=added) or removal (action=removed) targeting an existing
 *  message id in the same conversation. */
export async function xmtpReact(
  line: string, messageId: string, emoji: string, action: 'added' | 'removed' = 'added',
): Promise<string> {
  const conv = await convOfLine(line);
  if (!conv) throw new Error(`XMTP conversation not found: ${line}`);
  const payload: ReactionContent = { reference: messageId, action, content: emoji, schema: 'unicode' };
  return await conv.send({ reaction: payload });
}

/** Send a Metro poll (`metro.box/poll:1.0`). The poll is encoded by PollCodec
 *  into an EncodedContent; we pass the codec's contentType so the SDK routes
 *  through the JS-codec send path (sendEncodedContent) rather than treating the
 *  object as a native content shape. Returns the poll's XMTP message id — the
 *  reference every vote targets. */
export async function xmtpSendPoll(line: string, poll: PollContent): Promise<string> {
  const conv = await convOfLine(line);
  if (!conv) throw new Error(`XMTP conversation not found: ${line}`);
  return await conv.send(poll, { contentType: POLL_CODEC.contentType });
}

/** Send a signature REQUEST (`metro.box/signatureRequest:1.0`) — either EIP-712
 *  typed data or a personal_sign string. Mirrors xmtpSendPoll. */
export async function xmtpSendSignatureRequest(
  line: string, content: SignatureRequestContent,
): Promise<string> {
  const conv = await convOfLine(line);
  if (!conv) throw new Error(`XMTP conversation not found: ${line}`);
  return await conv.send(content, { contentType: SIGNATURE_REQUEST_CODEC.contentType });
}

/** Post a signature RECEIPT (`metro.box/signatureReference:1.0`) back. Mirrors xmtpSendPoll. */
export async function xmtpSendSignatureReference(
  line: string, ref: SignatureReferenceContent,
): Promise<string> {
  const conv = await convOfLine(line);
  if (!conv) throw new Error(`XMTP conversation not found: ${line}`);
  return await conv.send(ref, { contentType: SIGNATURE_REFERENCE_CODEC.contentType });
}

/** Send an in-chat payment REQUEST (`xmtp.org/walletSendCalls:1.0`). The
 *  WalletSendCalls is encoded by WalletSendCallsCodec; we pass the codec's
 *  contentType so the SDK routes through the JS-codec send path. Returns the
 *  request's XMTP message id. Mirrors xmtpSendPoll. */
export async function xmtpSendTxRequest(line: string, params: WalletSendCallsContent): Promise<string> {
  const conv = await convOfLine(line);
  if (!conv) throw new Error(`XMTP conversation not found: ${line}`);
  return await conv.send(params, { contentType: WALLET_SEND_CALLS_CODEC.contentType });
}

/** Post a payment RECEIPT (`xmtp.org/transactionReference:1.0`) back into the
 *  conversation after the payer broadcasts the tx. Mirrors xmtpSendPoll. */
export async function xmtpSendTxReference(line: string, ref: TransactionReferenceContent): Promise<string> {
  const conv = await convOfLine(line);
  if (!conv) throw new Error(`XMTP conversation not found: ${line}`);
  return await conv.send(ref, { contentType: TRANSACTION_REFERENCE_CODEC.contentType });
}

/** Cast (`added`) or retract (`removed`) a poll vote. A vote is just a reaction
 *  with `schema:'custom'` whose `content` is the chosen option INDEX and whose
 *  `reference` is the poll message id — so votes reuse the reaction tally +
 *  cross-device sync with zero new content type. */
export async function xmtpVote(
  line: string, pollMessageId: string, optionIndex: number,
  action: 'added' | 'removed' = 'added',
): Promise<string> {
  const conv = await convOfLine(line);
  if (!conv) throw new Error(`XMTP conversation not found: ${line}`);
  const payload: ReactionContent = {
    reference: pollMessageId, action, content: String(optionIndex), schema: 'custom',
  };
  return await conv.send({ reaction: payload });
}

/** Send an XMTP reply (text body referencing an earlier message id). */
export async function xmtpReply(line: string, replyTo: string, text: string): Promise<string> {
  const conv = await convOfLine(line);
  if (!conv) throw new Error(`XMTP conversation not found: ${line}`);
  const payload: ReplyContent = { reference: replyTo, content: { text } };
  return await conv.send({ reply: payload });
}

/** Send an inline (static) XMTP attachment. `dataB64` is the raw bytes base64-encoded
 *  (matches the RN SDK bridge convention). Good for files < ~1 MB; larger payloads
 *  should use the remote-attachment flow (TODO). */
export async function xmtpSendAttachment(
  line: string, filename: string, mimeType: string, dataB64: string,
): Promise<string> {
  const conv = await convOfLine(line);
  if (!conv) throw new Error(`XMTP conversation not found: ${line}`);
  const payload: StaticAttachmentContent = { filename, mimeType, data: dataB64 };
  /** Use the typed `sendAttachment` helper (not the generic `send({attachment})`) so the
   *  native side runs the codec's full encode + size-validation path and surfaces real
   *  errors instead of silently dropping payloads that exceed libxmtp's per-message limit. */

  const c = conv as unknown as { sendAttachment?: (p: StaticAttachmentContent) => Promise<string> };
  if (typeof c.sendAttachment === 'function') return await c.sendAttachment(payload);
  return await conv.send({ attachment: payload });
}
