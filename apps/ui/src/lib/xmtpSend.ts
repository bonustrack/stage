
import {
  ReactionAction, ReactionSchema, encodeText,
  type Reaction, type Reply, type Attachment as AttachmentContent,
} from '@xmtp/browser-sdk';
import { type PollContent, mintPollId, voteKey } from '@stage-labs/client/xmtp/poll';
import {
  convOfLine, getCachedXmtpClient, getOrCreateXmtpClient,
} from './xmtp';
import type { SignatureReferenceContent, SignatureRequestContent } from '@stage-labs/client/xmtp/sign';
import type { WalletSendCallsContent } from '@stage-labs/client/xmtp/tx';
import { buildPublicTransfer } from '@stage-labs/client/xmtp/tx';
import {
  buildPersonalSignatureRequest, buildEip712SignatureRequest,
} from '@stage-labs/client/xmtp/sign';
import { getActiveAccount } from './xmtp';
import { POLL_CODEC } from './xmtpPollCodec';
import {
  SIGNATURE_REFERENCE_CODEC, WALLET_SEND_CALLS_CODEC, SIGNATURE_REQUEST_CODEC,
} from './xmtpRequestCodecs';

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function xmtpSendText(line: string, text: string): Promise<string> {
  const conv = await convOfLine(line);
  if (!conv) throw new Error(`XMTP conversation not found: ${line}`);
  return await conv.sendText(text);
}

export async function xmtpReact(
  line: string, messageId: string, emoji: string, action: 'added' | 'removed' = 'added',
): Promise<string> {
  const conv = await convOfLine(line);
  if (!conv) throw new Error(`XMTP conversation not found: ${line}`);
  const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
  const payload: Reaction = {
    reference: messageId,
    referenceInboxId: client.inboxId ?? '',
    action: action === 'added' ? ReactionAction.Added : ReactionAction.Removed,
    content: emoji,
    schema: ReactionSchema.Unicode,
  };
  return await conv.sendReaction(payload);
}

export async function xmtpReply(line: string, replyTo: string, text: string): Promise<string> {
  const conv = await convOfLine(line);
  if (!conv) throw new Error(`XMTP conversation not found: ${line}`);
  const encoded = await encodeText(text);
  const reply: Reply = { content: encoded, reference: replyTo };
  return await conv.sendReply(reply);
}

export async function xmtpSendPoll(
  line: string, question: string, options: string[], opts?: { header?: string; multiSelect?: boolean },
): Promise<{ messageId: string; poll: PollContent }> {
  const conv = await convOfLine(line);
  if (!conv) throw new Error(`XMTP conversation not found: ${line}`);
  const poll: PollContent = {
    pollId: mintPollId(),
    question,
    ...(opts?.header?.trim() ? { header: opts.header.trim() } : {}),
    options: options.map(label => ({ label })),
    ...(opts?.multiSelect ? { multiSelect: true } : {}),
  };
  const encoded = POLL_CODEC.encode(poll);
  const messageId = await conv.send(encoded);
  return { messageId, poll };
}

export async function xmtpVote(
  line: string, pollMessageId: string, optionIndex: number,
  action: 'added' | 'removed' = 'added', questionIndex = 0,
): Promise<string> {
  const conv = await convOfLine(line);
  if (!conv) throw new Error(`XMTP conversation not found: ${line}`);
  const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
  const payload: Reaction = {
    reference: pollMessageId,
    referenceInboxId: client.inboxId ?? '',
    action: action === 'added' ? ReactionAction.Added : ReactionAction.Removed,
    content: voteKey(questionIndex, optionIndex),
    schema: ReactionSchema.Custom,
  };
  return await conv.sendReaction(payload);
}

export async function xmtpSendPayment(
  line: string, params: { to: string; amount: string; note?: string },
): Promise<{ messageId: string; content: WalletSendCallsContent }> {
  const conv = await convOfLine(line);
  if (!conv) throw new Error(`XMTP conversation not found: ${line}`);
  const acct = await getActiveAccount();
  if (!acct) throw new Error('No active account');
  const content = buildPublicTransfer({
    from: acct.address, to: params.to, amount: params.amount, ...(params.note ? { note: params.note } : {}),
  });
  const encoded = WALLET_SEND_CALLS_CODEC.encode(content);
  const messageId = await conv.send(encoded);
  return { messageId, content };
}

export async function xmtpSendSignRequest(
  line: string,
  params: { kind: 'personal'; message: string; description?: string }
    | { kind: 'eip712'; json: string; description?: string },
): Promise<{ messageId: string; content: SignatureRequestContent }> {
  const conv = await convOfLine(line);
  if (!conv) throw new Error(`XMTP conversation not found: ${line}`);
  const content = params.kind === 'personal'
    ? buildPersonalSignatureRequest(params.message, params.description)
    : buildEip712SignatureRequest(params.json, params.description);
  const encoded = SIGNATURE_REQUEST_CODEC.encode(content);
  const messageId = await conv.send(encoded);
  return { messageId, content };
}

export async function xmtpSendSignatureReference(
  line: string, ref: SignatureReferenceContent,
): Promise<string> {
  const conv = await convOfLine(line);
  if (!conv) throw new Error(`XMTP conversation not found: ${line}`);
  const encoded = SIGNATURE_REFERENCE_CODEC.encode(ref);
  return await conv.send(encoded);
}

export async function xmtpSendAttachment(
  line: string, filename: string, mimeType: string, dataB64: string,
): Promise<string> {
  const conv = await convOfLine(line);
  if (!conv) throw new Error(`XMTP conversation not found: ${line}`);
  const att: AttachmentContent = { filename, mimeType, content: base64ToBytes(dataB64) };
  return await conv.sendAttachment(att);
}
