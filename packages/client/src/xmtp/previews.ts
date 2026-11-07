import { attachmentsPreview, humanizeGroupUpdated, humanizeMentions, type AttachmentMeta, type GroupUpdatedContent } from './humanize';
import { deletedByOfContent, deletedTextOf } from './deleteMessage';
import { parseOpenVote, parseVoteKey } from './poll-tally';
import { paymentRequestPreview, receiptTitle, type TransactionReferenceContent, type WalletSendCallsContent } from './tx';
import { frameActionText } from './frame';
import { objectOf, stringOf, type CanonicalReply } from './message';

export type PreviewOf = (decoded: unknown) => string;

export const previewReply: PreviewOf = (decoded) => {
  const text = (decoded as CanonicalReply | null)?.text;
  return text ? humanizeMentions(text) : '[reply]';
};

export const previewPoll: PreviewOf = (decoded) => {
  const p = decoded as { question?: string; questions?: { question?: string }[] };
  const title = p.questions?.[0]?.question ?? p.question;
  return title ? `Poll: ${title}` : '[poll]';
};

const POLL_VOTE_PREVIEW = 'Voted in a poll';
const POLL_ANSWER_PREVIEW = 'Answered a poll';

export const previewReaction: PreviewOf = (decoded) => {
  const content = (decoded as { content?: string } | null)?.content ?? '👍';
  if (parseOpenVote(content)) return POLL_ANSWER_PREVIEW;
  return parseVoteKey(content) ? POLL_VOTE_PREVIEW : content;
};

export const previewFrame: PreviewOf = (decoded) => {
  const title = (decoded as { title?: unknown } | null)?.title;
  return typeof title === 'string' && title.trim() !== '' ? `Frame: ${title.trim()}` : 'Frame';
};

export const previewFrameAction: PreviewOf = (decoded) => {
  const content = objectOf(decoded) ?? {};
  const action = objectOf(content.action) ?? {};
  const label = stringOf(content.label) ?? '';
  const name = stringOf(action.name) ?? '';
  const userMessage = stringOf(action.userMessage);
  if (`${label}${name}${userMessage ?? ''}`.trim() === '') return '[frame action]';
  return frameActionText({ label, action: { name, userMessage } });
};

export const previewSingleAttachment: PreviewOf = (decoded) => attachmentsPreview(decoded ? [decoded] : []);

export const previewMultiRemote: PreviewOf = (decoded) => {
  const content = decoded as { attachments?: AttachmentMeta[] } | null | undefined;
  return attachmentsPreview(content?.attachments ?? []);
};

export const previewGroupUpdate: PreviewOf = (decoded) => humanizeGroupUpdated(decoded as GroupUpdatedContent);

export const previewDeleted: PreviewOf = (decoded) => deletedTextOf(deletedByOfContent(decoded));

export const previewPaymentRequest: PreviewOf = (decoded) => paymentRequestPreview(decoded as WalletSendCallsContent | null);

export const previewReceipt: PreviewOf = (decoded) => receiptTitle(decoded as TransactionReferenceContent | null);

export function fixedPreview(text: string): PreviewOf {
  return () => text;
}
