import {
  ReactionAction, ReactionSchema, encodeText,
  type Conversation, type Reaction,
} from '@xmtp/browser-sdk';
import {
  buildReaction, buildVote, buildOpenAnswer, type ReactionPayload,
} from '@stage-labs/client/xmtp/builders';
import { openVoteKey, type PollContent } from '@stage-labs/client/xmtp/poll';
import {
  type SignatureRequestContent, type SignatureReferenceContent,
} from '@stage-labs/client/xmtp/sign';
import {
  type WalletSendCallsContent, type TransactionReferenceContent,
} from '@stage-labs/client/xmtp/tx';
import { convOfLine } from './xmtp.client.web';
import {
  POLL_CODEC, SIGNATURE_REQUEST_CODEC, SIGNATURE_REFERENCE_CODEC,
  WALLET_SEND_CALLS_CODEC, TRANSACTION_REFERENCE_CODEC,
} from './xmtp.codecs.web';

export { envelopeOfXmtpMessage } from './xmtp.envelope';

type SendableConv = Conversation;
type EncodedContentArg = Parameters<SendableConv['send']>[0];

async function requireConv(line: string): Promise<SendableConv> {
  const conv = await convOfLine(line);
  if (!conv) throw new Error(`XMTP conversation not found: ${line}`);
  return conv;
}

function asEncoded(content: { content: Uint8Array }): EncodedContentArg {
  return content as unknown as EncodedContentArg;
}

function toWasmReaction(r: ReactionPayload): Reaction {
  return {
    reference: r.reference,
    referenceInboxId: '',
    action: r.action === 'removed' ? ReactionAction.Removed : ReactionAction.Added,
    content: r.content,
    schema: r.schema === 'custom' ? ReactionSchema.Custom : ReactionSchema.Unicode,
  };
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

export async function xmtpSendText(line: string, text: string): Promise<string> {
  const conv = await requireConv(line);
  return await conv.sendText(text);
}

export async function xmtpReact(
  line: string, messageId: string, emoji: string, action: 'added' | 'removed' = 'added',
): Promise<string> {
  const conv = await requireConv(line);
  return await conv.sendReaction(toWasmReaction(buildReaction(messageId, emoji, action)));
}

export async function xmtpSendPoll(line: string, poll: PollContent): Promise<string> {
  const conv = await requireConv(line);
  return await conv.send(asEncoded(POLL_CODEC.encode(poll)));
}

export async function xmtpSendSignatureRequest(
  line: string, content: SignatureRequestContent,
): Promise<string> {
  const conv = await requireConv(line);
  return await conv.send(asEncoded(SIGNATURE_REQUEST_CODEC.encode(content)));
}

export async function xmtpSendSignatureReference(
  line: string, ref: SignatureReferenceContent,
): Promise<string> {
  const conv = await requireConv(line);
  return await conv.send(asEncoded(SIGNATURE_REFERENCE_CODEC.encode(ref)));
}

export async function xmtpSendTxRequest(line: string, params: WalletSendCallsContent): Promise<string> {
  const conv = await requireConv(line);
  return await conv.send(asEncoded(WALLET_SEND_CALLS_CODEC.encode(params)));
}

export async function xmtpSendTxReference(line: string, ref: TransactionReferenceContent): Promise<string> {
  const conv = await requireConv(line);
  return await conv.send(asEncoded(TRANSACTION_REFERENCE_CODEC.encode(ref)));
}

export async function xmtpVote(
  line: string, pollMessageId: string, optionIndex: number,
  action: 'added' | 'removed' = 'added', questionIndex = 0,
): Promise<string> {
  const conv = await requireConv(line);
  return await conv.sendReaction(toWasmReaction(buildVote(pollMessageId, optionIndex, action, questionIndex)));
}

export async function xmtpOpenAnswer(
  line: string, pollMessageId: string, questionIndex: number, text: string,
): Promise<string> {
  const conv = await requireConv(line);
  const trimmed = text.trim();
  const action = trimmed ? 'added' : 'removed';
  const content = openVoteKey(questionIndex, trimmed);
  return await conv.sendReaction(toWasmReaction(buildOpenAnswer(pollMessageId, content, action)));
}

export async function xmtpReply(line: string, replyTo: string, text: string): Promise<string> {
  const conv = await requireConv(line);
  return await conv.sendReply({ reference: replyTo, content: await encodeText(text) });
}

export async function xmtpSendAttachment(
  line: string, filename: string, mimeType: string, dataB64: string,
): Promise<string> {
  const conv = await requireConv(line);
  return await conv.sendAttachment({ filename, mimeType, content: base64ToBytes(dataB64) });
}
