import type { HistoryEntry } from '@stage-labs/client/types';
import type { StreamedMessage } from '@stage-labs/client/xmtp/summarizeRow';
import { isXmtpDeletableType } from '@stage-labs/client/xmtp/deleteMessage';
import { buildReaction, buildVote, buildOpenAnswer, type ReactionPayload } from '@stage-labs/client/xmtp/builders';
import { openVoteKey, type PollContent } from '@stage-labs/client/xmtp/poll';
import type { SignatureRequestContent, SignatureReferenceContent } from '@stage-labs/client/xmtp/sign';
import type { WalletSendCallsContent, TransactionReferenceContent } from '@stage-labs/client/xmtp/tx';
import type { FrameActionContent } from '@stage-labs/client/xmtp/frame';
import { convOfLine, sdk, sendableConvOfLine } from './xmtp.sdk';
import { withReadableSendError } from './xmtp.sdk.core';
import {
  DELETE_REQUEST_CODEC, POLL_CODEC, SIGNATURE_REQUEST_CODEC, SIGNATURE_REFERENCE_CODEC,
  WALLET_SEND_CALLS_CODEC, TRANSACTION_REFERENCE_CODEC, FRAME_ACTION_CODEC, type JsonCodec,
} from '@stage-labs/client/xmtp/jsonCodecs';

export type ConvHandle = NonNullable<Awaited<ReturnType<typeof convOfLine>>>;

type ReactionAction = 'added' | 'removed';

export async function rowMessagesOf(conv: ConvHandle, limit: number): Promise<StreamedMessage[]> {
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

export function xmtpDeleteMessage(messageId: string): Promise<string> {
  return withReadableSendError(async () => {
    const target = await sdk.messageTarget(await sdk.client(), messageId);
    if (!target) throw new Error('Message not found');
    return isXmtpDeletableType(target.contentTypeId)
      ? sdk.deleteMessage(target.conv, messageId)
      : sdk.send.json(target.conv, DELETE_REQUEST_CODEC, { messageId });
  });
}

function sendOn(line: string, send: (conv: ConvHandle) => Promise<string>): Promise<string> {
  return withReadableSendError(async () => send(await sendableConvOfLine(line)));
}

export function xmtpSendText(line: string, text: string): Promise<string> {
  return sendOn(line, conv => sdk.send.text(conv, text));
}

function sendReaction(line: string, reaction: ReactionPayload): Promise<string> {
  return sendOn(line, conv => sdk.send.reaction(conv, reaction));
}

export function xmtpReact(line: string, messageId: string, emoji: string, action: ReactionAction = 'added'): Promise<string> {
  return sendReaction(line, buildReaction(messageId, emoji, action));
}

export function xmtpSendJson<T>(line: string, codec: JsonCodec<T>, content: T): Promise<string> {
  return sendOn(line, conv => sdk.send.json(conv, codec, content));
}

export const xmtpSendPoll = (line: string, poll: PollContent): Promise<string> => xmtpSendJson(line, POLL_CODEC, poll);

export const xmtpSendSignatureRequest = (line: string, content: SignatureRequestContent): Promise<string> =>
  xmtpSendJson(line, SIGNATURE_REQUEST_CODEC, content);

export const xmtpSendSignatureReference = (line: string, ref: SignatureReferenceContent): Promise<string> =>
  xmtpSendJson(line, SIGNATURE_REFERENCE_CODEC, ref);

export const xmtpSendTxRequest = (line: string, params: WalletSendCallsContent): Promise<string> =>
  xmtpSendJson(line, WALLET_SEND_CALLS_CODEC, params);

export const xmtpSendTxReference = (line: string, ref: TransactionReferenceContent): Promise<string> =>
  xmtpSendJson(line, TRANSACTION_REFERENCE_CODEC, ref);

export const xmtpSendFrameAction = (line: string, content: FrameActionContent): Promise<string> =>
  xmtpSendJson(line, FRAME_ACTION_CODEC, content);

export function xmtpVote(
  line: string, pollMessageId: string, optionIndex: number, action: ReactionAction = 'added', questionIndex = 0,
): Promise<string> {
  return sendReaction(line, buildVote(pollMessageId, optionIndex, action, questionIndex));
}

export function xmtpOpenAnswer(line: string, pollMessageId: string, questionIndex: number, text: string): Promise<string> {
  const trimmed = text.trim();
  return sendReaction(line, buildOpenAnswer(pollMessageId, openVoteKey(questionIndex, trimmed), trimmed ? 'added' : 'removed'));
}

export function xmtpReply(line: string, replyTo: string, text: string): Promise<string> {
  return sendOn(line, conv => sdk.send.reply(conv, replyTo, text));
}
