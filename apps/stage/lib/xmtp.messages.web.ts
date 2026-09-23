import {
  ReactionAction, ReactionSchema, SortDirection, encodeText,
  type Conversation, type Reaction,
} from '@xmtp/browser-sdk';
import type { HistoryEntry } from '@stage-labs/client/types';
import type { ReactionPayload } from '@stage-labs/client/xmtp/builders';
import type { RowMessage } from '@stage-labs/client/xmtp/summarizeRow';
import { convOfLine } from './xmtp.client.web';
import { makeSenders } from './xmtp.send.core';

import { envelopeOfXmtpMessage } from './xmtp.envelope.web';

export { envelopeOfXmtpMessage };

export async function rowMessagesOf(conv: unknown, limit: number): Promise<RowMessage[]> {
  const c = conv as Conversation;
  const msgs = await c.messages({ limit: BigInt(limit), direction: SortDirection.Descending });
  return msgs.map(m => ({
    content: m.content,
    contentTypeId: m.contentType.typeId,
    senderInboxId: m.senderInboxId,
    sentNs: Number(m.sentAtNs),
  }));
}

export type ConvHandle = NonNullable<Awaited<ReturnType<typeof convOfLine>>>;

export async function latestConvMessages(
  conv: ConvHandle, line: string, limit: number,
): Promise<HistoryEntry[]> {
  const msgs = await conv.messages({ limit: BigInt(limit), direction: SortDirection.Descending });
  return msgs.map(m => envelopeOfXmtpMessage(m, line));
}

export async function olderConvMessages(line: string, beforeTsMs: number, limit: number): Promise<HistoryEntry[]> {
  const conv = await convOfLine(line);
  if (!conv) return [];
  const older = await conv.messages({
    limit: BigInt(limit),
    sentBeforeNs: BigInt(beforeTsMs) * BigInt(1_000_000),
    direction: SortDirection.Descending,
  });
  return older.map(m => envelopeOfXmtpMessage(m, line));
}

type EncodedContentArg = Parameters<Conversation['send']>[0];

async function requireConv(line: string): Promise<Conversation> {
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

export const {
  xmtpSendText, xmtpReact, xmtpSendJson, xmtpSendPoll, xmtpSendSignatureRequest, xmtpSendSignatureReference,
  xmtpSendTxRequest, xmtpSendTxReference, xmtpVote, xmtpOpenAnswer, xmtpReply, xmtpSendAttachment,
} = makeSenders({
  text: async (line, text) => (await requireConv(line)).sendText(text),
  reaction: async (line, reaction) => (await requireConv(line)).sendReaction(toWasmReaction(reaction)),
  reply: async (line, replyTo, text) =>
    (await requireConv(line)).sendReply({ reference: replyTo, content: await encodeText(text) }),
  json: async (line, codec, content) => (await requireConv(line)).send(asEncoded(codec.encode(content))),
  attachment: async (line, filename, mimeType, dataB64) =>
    (await requireConv(line)).sendAttachment({ filename, mimeType, content: base64ToBytes(dataB64) }),
});
