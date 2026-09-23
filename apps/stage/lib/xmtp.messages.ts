import type { HistoryEntry } from '@stage-labs/client/types';
import type { RowMessage } from '@stage-labs/client/xmtp/summarizeRow';
import { convOfLine, sdk } from './xmtp.sdk';
import { makeSenders } from './xmtp.send.core';

export type ConvHandle = NonNullable<Awaited<ReturnType<typeof convOfLine>>>;

export async function rowMessagesOf(conv: ConvHandle, limit: number): Promise<RowMessage[]> {
  return (await sdk.messages(conv, { limit })).map(sdk.rowOf);
}

export async function latestConvMessages(
  conv: ConvHandle, line: string, limit: number,
): Promise<HistoryEntry[]> {
  const msgs = await sdk.messages(conv, { limit, order: 'desc' });
  return msgs.map(m => sdk.envelopeOf(m, line));
}

export async function olderConvMessages(line: string, beforeTsMs: number, limit: number): Promise<HistoryEntry[]> {
  const conv = await convOfLine(line);
  if (!conv) return [];
  const older = await sdk.messages(conv, { limit, beforeMs: beforeTsMs, order: 'desc' });
  return older.map(m => sdk.envelopeOf(m, line));
}

async function requireConv(line: string): Promise<ConvHandle> {
  const conv = await convOfLine(line);
  if (!conv) throw new Error(`XMTP conversation not found: ${line}`);
  return conv;
}

export const {
  xmtpSendText, xmtpReact, xmtpSendJson, xmtpSendPoll, xmtpSendSignatureRequest, xmtpSendSignatureReference,
  xmtpSendTxRequest, xmtpSendTxReference, xmtpVote, xmtpOpenAnswer, xmtpReply, xmtpSendAttachment,
} = makeSenders({
  text: async (line, text) => sdk.send.text(await requireConv(line), text),
  reaction: async (line, reaction) => sdk.send.reaction(await requireConv(line), reaction),
  reply: async (line, replyTo, text) => sdk.send.reply(await requireConv(line), replyTo, text),
  json: async (line, codec, content) => sdk.send.json(await requireConv(line), codec, content),
  attachment: async (line, filename, mimeType, dataB64) =>
    sdk.send.attachment(await requireConv(line), filename, mimeType, dataB64),
});
