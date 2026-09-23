
import { buildReply, buildStaticAttachment } from '@stage-labs/client/xmtp/builders';
import type { RowMessage } from '@stage-labs/client/xmtp/summarizeRow';
import { convOfLine } from './xmtp.client';
import { makeSenders } from './xmtp.send.core';

import type { HistoryEntry } from '@stage-labs/client/types';
import { mapDecodedToEnvelope as envelopeOfXmtpMessage } from '@stage-labs/client/xmtp/envelope';

export { envelopeOfXmtpMessage };

export async function rowMessagesOf(conv: unknown, limit: number): Promise<RowMessage[]> {
  const c = conv as {
    messages: (opts: { limit: number }) => Promise<{
      content: () => unknown; contentTypeId?: string; senderInboxId: string; sentNs: number;
    }[]>;
  };
  const msgs = await c.messages({ limit });
  return msgs.map(m => {
    let content: unknown;
    try { content = m.content(); } catch { content = undefined; }
    return {
      content,
      contentTypeId: m.contentTypeId,
      senderInboxId: m.senderInboxId,
      sentNs: m.sentNs,
    };
  });
}

export type ConvHandle = NonNullable<Awaited<ReturnType<typeof convOfLine>>>;

export async function latestConvMessages(
  conv: ConvHandle, line: string, limit: number,
): Promise<HistoryEntry[]> {
  const msgs = await conv.messages({ limit, direction: 'DESCENDING' });
  return msgs.map(m => envelopeOfXmtpMessage(m, line));
}

export async function olderConvMessages(line: string, beforeTsMs: number, limit: number): Promise<HistoryEntry[]> {
  const conv = await convOfLine(line);
  if (!conv) return [];
  const older = await conv.messages({ limit, beforeNs: beforeTsMs * 1_000_000, direction: 'DESCENDING' });
  return older.map(m => envelopeOfXmtpMessage(m, line));
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
  text: async (line, text) => (await requireConv(line)).send(text),
  reaction: async (line, reaction) => (await requireConv(line)).send({ reaction }),
  reply: async (line, replyTo, text) => (await requireConv(line)).send({ reply: buildReply(replyTo, text) }),
  json: async (line, codec, content) => (await requireConv(line)).send(content, { contentType: codec.contentType }),
  attachment: async (line, filename, mimeType, dataB64) => {
    const conv = await requireConv(line);
    return conv.send({ attachment: buildStaticAttachment(filename, mimeType, dataB64) });
  },
});
