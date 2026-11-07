import { ReactionAction, ReactionSchema } from '@xmtp/browser-sdk';
import { bytesToBase64 } from '@stage-labs/client/text/base64';
import {
  objectOf,
  stringOf,
  type CanonicalAttachment,
  type CanonicalDeletedMessage,
  type CanonicalReaction,
  type CanonicalReply,
  type XmtpMessage,
} from '@stage-labs/client/xmtp/message';
import { canonicalContent, type CanonicalReaders } from './xmtp.sdk.core';

interface WebMessageView {
  id: string;
  senderInboxId: string;
  sentAtNs: bigint;
  sentAt: Date;
  contentType: { typeId: string };
  content: unknown;
  fallback?: string;
}

const ADMIN_DELETED_BY = 1;

function reactionOf(raw: Record<string, unknown>): CanonicalReaction {
  return {
    reference: raw.reference as string,
    content: raw.content as string,
    removed: raw.action === ReactionAction.Removed || raw.action === 'removed',
    custom: raw.schema === ReactionSchema.Custom || raw.schema === 'custom',
  };
}

function replyOf(raw: Record<string, unknown>): CanonicalReply {
  return { reference: stringOf(raw.referenceId) ?? '', text: stringOf(raw.content), remote: objectOf(raw.content) };
}

function attachmentOf(raw: Record<string, unknown>): CanonicalAttachment {
  const data = raw.content instanceof Uint8Array ? bytesToBase64(raw.content) : '';
  return { filename: stringOf(raw.filename), mimeType: stringOf(raw.mimeType), dataB64: data };
}

function deletedOf(raw: Record<string, unknown>): CanonicalDeletedMessage {
  return { deletedBy: raw.deletedBy === ADMIN_DELETED_BY ? 'admin' : 'sender' };
}

const CANONICAL: CanonicalReaders = { reaction: reactionOf, reply: replyOf, attachment: attachmentOf, deletedMessage: deletedOf };

export function webMessageOf(m: WebMessageView): XmtpMessage {
  const contentTypeId = m.contentType.typeId;
  return {
    id: m.id,
    senderInboxId: m.senderInboxId,
    sentNs: Number(m.sentAtNs),
    sentMs: m.sentAt.getTime(),
    contentTypeId,
    content: canonicalContent(CANONICAL, contentTypeId, m.content),
    ...(m.fallback === undefined ? {} : { fallback: m.fallback }),
  };
}
