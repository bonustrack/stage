
import {
  buildReaction, buildVote, buildOpenAnswer, buildReply, buildStaticAttachment,
} from '@stage-labs/client/xmtp/builders';
import { openVoteKey, type PollContent } from '@stage-labs/client/xmtp/poll';
import {
  type SignatureRequestContent, type SignatureReferenceContent,
} from '@stage-labs/client/xmtp/sign';
import {
  type WalletSendCallsContent, type TransactionReferenceContent,
} from '@stage-labs/client/xmtp/tx';
import { convOfLine } from './xmtp.client';
import {
  POLL_CODEC, SIGNATURE_REQUEST_CODEC, SIGNATURE_REFERENCE_CODEC,
  WALLET_SEND_CALLS_CODEC, TRANSACTION_REFERENCE_CODEC,
} from './xmtp.codecs';

export { envelopeOfXmtpMessage } from './xmtp.envelope';

export async function xmtpSendText(line: string, text: string): Promise<string> {
  const conv = await convOfLine(line);
  if (!conv) throw new Error(`XMTP conversation not found: ${line}`);
  return await conv.send(text);
}

export async function xmtpReact(
  line: string, messageId: string, emoji: string, action: 'added' | 'removed' = 'added',
): Promise<string> {
  const conv = await convOfLine(line);
  if (!conv) throw new Error(`XMTP conversation not found: ${line}`);
  return await conv.send({ reaction: buildReaction(messageId, emoji, action) });
}

export async function xmtpSendPoll(line: string, poll: PollContent): Promise<string> {
  const conv = await convOfLine(line);
  if (!conv) throw new Error(`XMTP conversation not found: ${line}`);
  return await conv.send(poll, { contentType: POLL_CODEC.contentType });
}

export async function xmtpSendSignatureRequest(
  line: string, content: SignatureRequestContent,
): Promise<string> {
  const conv = await convOfLine(line);
  if (!conv) throw new Error(`XMTP conversation not found: ${line}`);
  return await conv.send(content, { contentType: SIGNATURE_REQUEST_CODEC.contentType });
}

export async function xmtpSendSignatureReference(
  line: string, ref: SignatureReferenceContent,
): Promise<string> {
  const conv = await convOfLine(line);
  if (!conv) throw new Error(`XMTP conversation not found: ${line}`);
  return await conv.send(ref, { contentType: SIGNATURE_REFERENCE_CODEC.contentType });
}

export async function xmtpSendTxRequest(line: string, params: WalletSendCallsContent): Promise<string> {
  const conv = await convOfLine(line);
  if (!conv) throw new Error(`XMTP conversation not found: ${line}`);
  return await conv.send(params, { contentType: WALLET_SEND_CALLS_CODEC.contentType });
}

export async function xmtpSendTxReference(line: string, ref: TransactionReferenceContent): Promise<string> {
  const conv = await convOfLine(line);
  if (!conv) throw new Error(`XMTP conversation not found: ${line}`);
  return await conv.send(ref, { contentType: TRANSACTION_REFERENCE_CODEC.contentType });
}

export async function xmtpVote(
  line: string, pollMessageId: string, optionIndex: number,
  action: 'added' | 'removed' = 'added', questionIndex = 0,
): Promise<string> {
  const conv = await convOfLine(line);
  if (!conv) throw new Error(`XMTP conversation not found: ${line}`);
  return await conv.send({ reaction: buildVote(pollMessageId, optionIndex, action, questionIndex) });
}

export async function xmtpOpenAnswer(
  line: string, pollMessageId: string, questionIndex: number, text: string,
): Promise<string> {
  const conv = await convOfLine(line);
  if (!conv) throw new Error(`XMTP conversation not found: ${line}`);
  const trimmed = text.trim();
  const action = trimmed ? 'added' : 'removed';
  const content = openVoteKey(questionIndex, trimmed);
  return await conv.send({ reaction: buildOpenAnswer(pollMessageId, content, action) });
}

export async function xmtpReply(line: string, replyTo: string, text: string): Promise<string> {
  const conv = await convOfLine(line);
  if (!conv) throw new Error(`XMTP conversation not found: ${line}`);
  return await conv.send({ reply: buildReply(replyTo, text) });
}

export async function xmtpSendAttachment(
  line: string, filename: string, mimeType: string, dataB64: string,
): Promise<string> {
  const conv = await convOfLine(line);
  if (!conv) throw new Error(`XMTP conversation not found: ${line}`);
  const payload = buildStaticAttachment(filename, mimeType, dataB64);

  const c = conv as unknown as { sendAttachment?: (p: typeof payload) => Promise<string> };
  if (typeof c.sendAttachment === 'function') return await c.sendAttachment(payload);
  return await conv.send({ attachment: payload });
}
