
import type { HistoryEntry } from '../types';
import { humanizeGroupUpdated, type GroupUpdatedContent } from './humanize';
import { type PollContent, pollFallbackText } from './poll';
import {
  type SignatureRequestContent, type SignatureReferenceContent,
  signatureRequestFallbackText, signatureReferenceFallbackText,
} from './sign';
import {
  type WalletSendCallsContent, type TransactionReferenceContent,
  walletSendCallsFallbackText, transactionReferenceFallbackText,
} from './tx';
import { XMTP_USER_PREFIX } from './line';

export interface DecodedMessageView {
  id: string;
  senderInboxId: string;
  sentNs: number;
  contentTypeId: string;
  content(): unknown;
  fallback?: string;
}

interface ReactionContentView {
  reference: string;
  action: string;
  content: string;
  schema: string;
}
interface ReplyContentView { reference: string; content?: { text?: string } }
interface StaticAttachmentView { filename: string; mimeType?: string; data: string }
interface MultiRemoteAttachmentView {
  attachments?: ({ filename?: string } & Record<string, unknown>)[];
}

function reactionEnvelope(base: HistoryEntry, typeId: string, decoded: unknown): HistoryEntry {
  const r = decoded as ReactionContentView;
  const removed = r.action === 'removed';
  if (r.schema === 'custom') {
    return {
      ...base,
      text: `[vote ${r.content}${removed ? ' (removed)' : ''}]`,
      payload: {
        contentType: typeId, reactTo: r.reference, emoji: r.content,
        schema: 'custom', voteFor: r.reference, optionIndex: Number(r.content), removed,
      },
    };
  }
  return {
    ...base,
    text: `[react ${r.content}${removed ? ' (removed)' : ''}]`,
    payload: { contentType: typeId, reactTo: r.reference, emoji: r.content, removed },
  };
}

function replyEnvelope(base: HistoryEntry, typeId: string, decoded: unknown): HistoryEntry {
  const r = decoded as ReplyContentView;
  return {
    ...base,
    text: r.content?.text ?? '[reply]',
    replyTo: r.reference,
    payload: { contentType: typeId, replyTo: r.reference },
  };
}

function kindFromMime(mime?: string): 'image' | 'audio' | 'video' | 'file' {
  if (mime?.startsWith('image/')) return 'image';
  if (mime?.startsWith('audio/')) return 'audio';
  if (mime?.startsWith('video/')) return 'video';
  return 'file';
}

function kindFromExt(name: string): 'image' | 'audio' | 'video' | 'file' {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext)) return 'image';
  if (['m4a', 'mp3', 'wav', 'aac', 'ogg'].includes(ext)) return 'audio';
  if (['mp4', 'mov', 'webm'].includes(ext)) return 'video';
  return 'file';
}

function attachmentEnvelope(base: HistoryEntry, typeId: string, decoded: unknown): HistoryEntry {
  const a = decoded as StaticAttachmentView;
  const kind = kindFromMime(a.mimeType);
  return {
    ...base,
    text: `[${kind}: ${a.filename}]`,
    payload: {
      contentType: typeId,
      attachments: [{ kind, mime: a.mimeType, name: a.filename, dataB64: a.data }],
    },
  };
}

function multiRemoteEnvelope(base: HistoryEntry, typeId: string, decoded: unknown): HistoryEntry {
  const m = decoded as MultiRemoteAttachmentView;
  const attachments = (m.attachments ?? []).map((info, i) => {
    const name = info.filename ?? `attachment-${i + 1}`;
    return { kind: kindFromExt(name), name, remote: info };
  });
  const first = attachments[0];
  const summary = first !== undefined && attachments.length === 1
    ? `[${first.kind}: ${first.name}]`
    : `[${attachments.length} attachments]`;
  return { ...base, text: summary, payload: { contentType: typeId, attachments } };
}

const ENVELOPE_HANDLERS: Record<
  string,
  (base: HistoryEntry, typeId: string, decoded: unknown) => HistoryEntry
> = {
  reaction: reactionEnvelope,
  poll: (base, typeId, decoded) => ({
    ...base, text: pollFallbackText(decoded as PollContent),
    payload: { contentType: typeId, poll: decoded as PollContent },
  }),
  signatureRequest: (base, typeId, decoded) => ({
    ...base, text: signatureRequestFallbackText(decoded as SignatureRequestContent),
    payload: { contentType: typeId, signatureRequest: decoded as SignatureRequestContent },
  }),
  signatureReference: (base, typeId, decoded) => ({
    ...base, text: signatureReferenceFallbackText(decoded as SignatureReferenceContent),
    payload: { contentType: typeId, signatureReference: decoded as SignatureReferenceContent },
  }),
  walletSendCalls: (base, typeId, decoded) => ({
    ...base, text: walletSendCallsFallbackText(decoded as WalletSendCallsContent),
    payload: { contentType: typeId, walletSendCalls: decoded as WalletSendCallsContent },
  }),
  transactionReference: (base, typeId, decoded) => ({
    ...base, text: transactionReferenceFallbackText(decoded as TransactionReferenceContent),
    payload: { contentType: typeId, txReference: decoded as TransactionReferenceContent },
  }),
  reply: replyEnvelope,
  group_updated: (base, typeId, decoded) => ({
    ...base, text: humanizeGroupUpdated(decoded as GroupUpdatedContent),
    payload: { contentType: typeId, system: true },
  }),
  groupUpdated: (base, typeId, decoded) => ({
    ...base, text: humanizeGroupUpdated(decoded as GroupUpdatedContent),
    payload: { contentType: typeId, system: true },
  }),
  attachment: attachmentEnvelope,
  multiRemoteStaticAttachment: multiRemoteEnvelope,
  multiRemoteAttachment: multiRemoteEnvelope,
};

export function mapDecodedToEnvelope(msg: DecodedMessageView, line: string): HistoryEntry {
  const ts = new Date(Math.floor(msg.sentNs / 1_000_000)).toISOString();
  const base: HistoryEntry = {
    id: msg.id, ts, station: 'xmtp', line,
    from: `${XMTP_USER_PREFIX}${msg.senderInboxId}`, to: line, messageId: msg.id,
  };
  const typeId = msg.contentTypeId.split('/').pop()?.split(':')[0] ?? 'unknown';
  let decoded: unknown;
  try { decoded = msg.content(); }
  catch { return { ...base, text: `[${typeId} payload]`, payload: { contentType: typeId } }; }

  if (typeof decoded === 'string') {
    return { ...base, text: decoded, payload: { contentType: typeId } };
  }
  const handler = ENVELOPE_HANDLERS[typeId];
  if (handler) return handler(base, typeId, decoded);
  return { ...base, text: msg.fallback ?? `[${typeId} payload]`, payload: { contentType: typeId } };
}
