import type { HistoryEntry } from '@stage-labs/client/types';
import type { RowMessage } from '@stage-labs/client/xmtp/summarizeRow';
import { convOfLine, sdk, sendableConvOfLine } from './xmtp.sdk';
import { withReadableSendError } from './xmtp.sdk.core';
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

function sendTo<A extends unknown[]>(
  send: (conv: ConvHandle, ...args: A) => Promise<string>,
): (line: string, ...args: A) => Promise<string> {
  return (line, ...args) => withReadableSendError(async () => send(await sendableConvOfLine(line), ...args));
}

export const {
  xmtpSendText, xmtpReact, xmtpSendJson, xmtpSendPoll, xmtpSendSignatureRequest, xmtpSendSignatureReference,
  xmtpSendTxRequest, xmtpSendTxReference, xmtpVote, xmtpOpenAnswer, xmtpReply, xmtpSendAttachment,
} = makeSenders({
  text: sendTo(sdk.send.text),
  reaction: sendTo(sdk.send.reaction),
  reply: sendTo(sdk.send.reply),
  json: (line, codec, content) => withReadableSendError(async () => sdk.send.json(await sendableConvOfLine(line), codec, content)),
  attachment: sendTo(sdk.send.attachment),
});
