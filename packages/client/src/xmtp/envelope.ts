/** @file Maps a decoded XMTP message onto the shared HistoryEntry envelope (the transport-agnostic shape the daemon train emits and MessengerBubble consumes) via a structural DecodedMessageView, so the package imports zero @xmtp/react-native/expo types. */

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

/** The structural subset of the RN SDK's `DecodedMessage` the envelope mapper reads. The app's native message satisfies this shape directly. */
export interface DecodedMessageView {
  id: string;
  senderInboxId: string;
  /** Nanoseconds since epoch (RN SDK form). */
  sentNs: number;
  /** e.g. `xmtp.org/text:1.0`. */
  contentTypeId: string;
  /** Decodes the body; may throw if the codec is unavailable. */
  content(): unknown;
  /** Plain-text fallback the codec supplied, if any. */
  fallback?: string;
}

/** Structural mirror of the RN SDK's `ReactionContent`. */
interface ReactionContentView {
  reference: string;
  /** 'added' | 'removed' (the RN SDK leaves this open-ended). */
  action: string;
  content: string;
  /** 'unicode' | 'custom' (the RN SDK leaves this open-ended). */
  schema: string;
}
/** Structural mirror of the RN SDK's `ReplyContent` (text-only inner content). */
interface ReplyContentView { reference: string; content?: { text?: string } }
/** Structural mirror of the RN SDK's `StaticAttachmentContent`. */
interface StaticAttachmentView { filename: string; mimeType?: string; data: string }
/** Structural mirror of the RN SDK's `MultiRemoteAttachmentContent`. */
interface MultiRemoteAttachmentView {
  attachments?: ({ filename?: string } & Record<string, unknown>)[];
}

/** Map a `reaction` content into its envelope — a poll vote (schema:'custom') carries voteFor/optionIndex so tally helpers can pick it out; otherwise a plain emoji react. */
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

/** Map a `reply` content into its envelope, surfacing the inner text + the referenced message id. */
function replyEnvelope(base: HistoryEntry, typeId: string, decoded: unknown): HistoryEntry {
  const r = decoded as ReplyContentView;
  return {
    ...base,
    text: r.content?.text ?? '[reply]',
    replyTo: r.reference,
    payload: { contentType: typeId, replyTo: r.reference },
  };
}

/** Infer an attachment `kind` (image/audio/video/file) from a MIME type, else 'file'. */
function kindFromMime(mime?: string): 'image' | 'audio' | 'video' | 'file' {
  if (mime?.startsWith('image/')) return 'image';
  if (mime?.startsWith('audio/')) return 'audio';
  if (mime?.startsWith('video/')) return 'video';
  return 'file';
}

/** Infer an attachment `kind` from a filename extension, else 'file'. */
function kindFromExt(name: string): 'image' | 'audio' | 'video' | 'file' {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext)) return 'image';
  if (['m4a', 'mp3', 'wav', 'aac', 'ogg'].includes(ext)) return 'audio';
  if (['mp4', 'mov', 'webm'].includes(ext)) return 'video';
  return 'file';
}

/** Map an inline `attachment` content (bytes already base64 over the RN bridge) into its envelope. */
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

/** Map a `multiRemoteAttachment` content (N encrypted-remote attachments on IPFS) into its envelope; MIME is absent so kind is inferred from the filename. */
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

/** Per-typeId envelope builders for non-string decoded XMTP content. Keys are the short authority-less content-type names. */
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

/** Convert a decoded XMTP message into the `HistoryEntry` envelope used by the daemon-side event log + the MessengerBubble renderer. Mirrors the shape emitted by the node-sdk train so the UI layer is transport-agnostic. */
export function mapDecodedToEnvelope(msg: DecodedMessageView, line: string): HistoryEntry {
  /** `sentNs` is nanoseconds. Divide to ms — ample precision for ts strings. */
  const ts = new Date(Math.floor(msg.sentNs / 1_000_000)).toISOString();
  const base: HistoryEntry = {
    id: msg.id, ts, station: 'xmtp', line,
    from: `${XMTP_USER_PREFIX}${msg.senderInboxId}`, to: line, messageId: msg.id,
  };
  /** typeId looks like `xmtp.org/text:1.0` — strip authority + version. */
  const typeId = msg.contentTypeId.split('/').pop()?.split(':')[0] ?? 'unknown';
  let decoded: unknown;
  try { decoded = msg.content(); }
  catch { return { ...base, text: `[${typeId} payload]`, payload: { contentType: typeId } }; }

  if (typeof decoded === 'string') {
    return { ...base, text: decoded, payload: { contentType: typeId } };
  }
  const handler = ENVELOPE_HANDLERS[typeId];
  if (handler) return handler(base, typeId, decoded);
  /** Unknown / unsupported codec — render fallback if the codec provided one. */
  return { ...base, text: msg.fallback ?? `[${typeId} payload]`, payload: { contentType: typeId } };
}
