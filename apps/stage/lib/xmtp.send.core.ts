import {
  buildReaction, buildVote, buildOpenAnswer, type ReactionPayload,
} from '@stage-labs/client/xmtp/builders';
import { openVoteKey, type PollContent } from '@stage-labs/client/xmtp/poll';
import type { SignatureRequestContent, SignatureReferenceContent } from '@stage-labs/client/xmtp/sign';
import type { WalletSendCallsContent, TransactionReferenceContent } from '@stage-labs/client/xmtp/tx';
import {
  POLL_CODEC, SIGNATURE_REQUEST_CODEC, SIGNATURE_REFERENCE_CODEC,
  WALLET_SEND_CALLS_CODEC, TRANSACTION_REFERENCE_CODEC, type JsonCodec,
} from './xmtpJsonCodecs';

interface SendPrimitives {
  text: (line: string, text: string) => Promise<string>;
  reaction: (line: string, reaction: ReactionPayload) => Promise<string>;
  reply: (line: string, replyTo: string, text: string) => Promise<string>;
  json: <T>(line: string, codec: JsonCodec<T>, content: T) => Promise<string>;
  attachment: (line: string, filename: string, mimeType: string, dataB64: string) => Promise<string>;
}

type ReactionAction = 'added' | 'removed';

export function makeSenders(p: SendPrimitives) {
  return {
    xmtpSendText: (line: string, text: string): Promise<string> => p.text(line, text),
    xmtpReact: (line: string, messageId: string, emoji: string, action: ReactionAction = 'added'): Promise<string> =>
      p.reaction(line, buildReaction(messageId, emoji, action)),
    xmtpSendJson: <T>(line: string, codec: JsonCodec<T>, content: T): Promise<string> => p.json(line, codec, content),
    xmtpSendPoll: (line: string, poll: PollContent): Promise<string> => p.json(line, POLL_CODEC, poll),
    xmtpSendSignatureRequest: (line: string, content: SignatureRequestContent): Promise<string> =>
      p.json(line, SIGNATURE_REQUEST_CODEC, content),
    xmtpSendSignatureReference: (line: string, ref: SignatureReferenceContent): Promise<string> =>
      p.json(line, SIGNATURE_REFERENCE_CODEC, ref),
    xmtpSendTxRequest: (line: string, params: WalletSendCallsContent): Promise<string> =>
      p.json(line, WALLET_SEND_CALLS_CODEC, params),
    xmtpSendTxReference: (line: string, ref: TransactionReferenceContent): Promise<string> =>
      p.json(line, TRANSACTION_REFERENCE_CODEC, ref),
    xmtpVote: (
      line: string, pollMessageId: string, optionIndex: number, action: ReactionAction = 'added', questionIndex = 0,
    ): Promise<string> => p.reaction(line, buildVote(pollMessageId, optionIndex, action, questionIndex)),
    xmtpOpenAnswer: (line: string, pollMessageId: string, questionIndex: number, text: string): Promise<string> => {
      const trimmed = text.trim();
      return p.reaction(line, buildOpenAnswer(pollMessageId, openVoteKey(questionIndex, trimmed), trimmed ? 'added' : 'removed'));
    },
    xmtpReply: (line: string, replyTo: string, text: string): Promise<string> => p.reply(line, replyTo, text),
    xmtpSendAttachment: (line: string, filename: string, mimeType: string, dataB64: string): Promise<string> =>
      p.attachment(line, filename, mimeType, dataB64),
  };
}
