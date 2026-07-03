
import {
  ReactionAction, ReactionSchema,
  type DecodedMessage,
  type Reaction, type Attachment as AttachmentContent,
} from '@xmtp/browser-sdk';
import type { HistoryEntry } from '@stage-labs/client/types';
import { envelopeFromContent, type EnvelopeOptions } from '@stage-labs/client/xmtp/envelope';
import { XMTP_USER_PREFIX } from './xmtp.types';

function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function isRemovedAction(action: Reaction['action']): boolean {
  return action === ReactionAction.Removed || (action as unknown) === 'removed';
}

function isCustomSchema(schema: Reaction['schema']): boolean {
  return schema === ReactionSchema.Custom || (schema as unknown) === 'custom';
}

const WEB_HANDLERS = new Set([
  'reaction', 'reply', 'attachment', 'poll', 'walletSendCalls', 'signatureRequest',
  'signatureReference', 'transactionReference', 'group_updated', 'groupUpdated',
  'multiRemoteStaticAttachment', 'multiRemoteAttachment',
]);

const webEnvelopeOptions: EnvelopeOptions = {
  reactionRemoved: (action) => isRemovedAction(action as Reaction['action']),
  reactionCustom: (schema) => isCustomSchema(schema as Reaction['schema']),
  reactionCustomPayloadExtras: false,
  replyReferenceOf: (decoded) => (decoded as { referenceId: string }).referenceId,
  replyTextOf: (decoded) => {
    const c = (decoded as { content: unknown }).content;
    return typeof c === 'string' ? c : undefined;
  },
  attachmentNameOf: (decoded) => (decoded as AttachmentContent).filename,
  attachmentLabelOf: (decoded) => (decoded as AttachmentContent).filename ?? 'attachment',
  attachmentDataB64Of: (decoded) => bytesToBase64((decoded as AttachmentContent).content),
  handlers: WEB_HANDLERS,
  requireObjectForHandlers: true,
};

export function envelopeOfXmtpMessage(msg: DecodedMessage, line: string): HistoryEntry {
  const base: HistoryEntry = {
    id: msg.id,
    ts: msg.sentAt.toISOString(),
    station: 'xmtp',
    line,
    from: `${XMTP_USER_PREFIX}${msg.senderInboxId}`,
    to: line,
    messageId: msg.id,
  };
  const typeId = msg.contentType.typeId;
  return envelopeFromContent(base, typeId, msg.content, msg.fallback, webEnvelopeOptions);
}
