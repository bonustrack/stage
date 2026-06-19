/**
 * @file Maps a decoded XMTP message onto the shared HistoryEntry envelope via a structural message view.
 */
/**
 * Map a decoded XMTP message -> the app/daemon `HistoryEntry` envelope.
 *
 *  This is the framework-agnostic shaping that turns a decoded message into the
 *  same `HistoryEntry` shape the daemon-side train emits + the MessengerBubble
 *  renderer consumes, so the UI doesn't care which transport an event came from.
 *
 *  The native @xmtp/react-native-sdk `DecodedMessage` stays in apps/app. This
 *  module operates on a structural VIEW of it (`DecodedMessageView`) — the few
 *  fields the mapper reads — so the package never imports the native type. The
 *  app passes its native message straight in (it satisfies the view). ZERO @xmtp
 *  / react-native / expo imports.
 */

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

/** Convert a decoded XMTP message into the `HistoryEntry` envelope used by the daemon-side event log + the MessengerBubble renderer. Mirrors the shape emitted by the node-sdk train so the UI layer is transport-agnostic. */
// eslint-disable-next-line complexity, max-lines-per-function -- TODO(chaitu): refactor to satisfy function-size limits
export function mapDecodedToEnvelope(msg: DecodedMessageView, line: string): HistoryEntry {
  const from = `${XMTP_USER_PREFIX}${msg.senderInboxId}`;
  /** `sentNs` is nanoseconds. Divide to ms — ample precision for ts strings. */
  const ts = new Date(Math.floor(msg.sentNs / 1_000_000)).toISOString();
  const base: HistoryEntry = {
    id: msg.id,
    ts,
    station: 'xmtp',
    line,
    from,
    to: line,
    messageId: msg.id,
  };
  /** typeId looks like `xmtp.org/text:1.0` — strip authority + version. */
  const typeId = msg.contentTypeId.split('/').pop()?.split(':')[0] ?? 'unknown';
  let decoded: unknown;
  try { decoded = msg.content(); }
  catch { return { ...base, text: `[${typeId} payload]`, payload: { contentType: typeId } }; }

  if (typeof decoded === 'string') {
    return { ...base, text: decoded, payload: { contentType: typeId } };
  }
  if (typeId === 'reaction') {
    const r = decoded as ReactionContentView;
    const removed = r.action === 'removed';
    /**
     * A poll VOTE is a reaction with schema:'custom' whose content is the
     *  option index. Surface `schema:'custom'` + `voteFor`/`optionIndex` so the
     *  tally helpers can pick votes out of history and the channels-list preview
     *  doesn't render an index as an emoji.
     */
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
  if (typeId === 'poll') {
    const poll = decoded as PollContent;
    return { ...base, text: pollFallbackText(poll), payload: { contentType: typeId, poll } };
  }
  if (typeId === 'signatureRequest') {
    const sig = decoded as SignatureRequestContent;
    return {
      ...base,
      text: signatureRequestFallbackText(sig),
      payload: { contentType: typeId, signatureRequest: sig },
    };
  }
  if (typeId === 'signatureReference') {
    const ref = decoded as SignatureReferenceContent;
    return {
      ...base,
      text: signatureReferenceFallbackText(ref),
      payload: { contentType: typeId, signatureReference: ref },
    };
  }
  if (typeId === 'walletSendCalls') {
    const wsc = decoded as WalletSendCallsContent;
    return {
      ...base,
      text: walletSendCallsFallbackText(wsc),
      payload: { contentType: typeId, walletSendCalls: wsc },
    };
  }
  if (typeId === 'transactionReference') {
    const ref = decoded as TransactionReferenceContent;
    return {
      ...base,
      text: transactionReferenceFallbackText(ref),
      payload: { contentType: typeId, txReference: ref },
    };
  }
  if (typeId === 'reply') {
    const r = decoded as ReplyContentView;
    const innerText = r.content?.text;
    return {
      ...base,
      text: innerText ?? `[reply]`,
      replyTo: r.reference,
      payload: { contentType: typeId, replyTo: r.reference },
    };
  }
  if (typeId === 'group_updated' || typeId === 'groupUpdated') {
    const summary = humanizeGroupUpdated(decoded as GroupUpdatedContent);
    return { ...base, text: summary, payload: { contentType: typeId, system: true } };
  }
  if (typeId === 'attachment') {
    const a = decoded as StaticAttachmentView;
    const kind = a.mimeType?.startsWith('image/') ? 'image'
      : a.mimeType?.startsWith('audio/') ? 'audio'
        : a.mimeType?.startsWith('video/') ? 'video' : 'file';
    return {
      ...base,
      text: `[${kind}: ${a.filename}]`,
      /** `data` arrives already base64-encoded over the RN bridge. Pass through. */
      payload: { contentType: typeId, attachments: [{ kind, mime: a.mimeType, name: a.filename, dataB64: a.data }] },
    };
  }
  if (typeId === 'multiRemoteStaticAttachment' || typeId === 'multiRemoteAttachment') {
    /**
     * One message carrying N encrypted-remote attachments. The bytes live on
     *  IPFS (ciphertext); each is rendered as a `remote` placeholder + lazily
     *  downloaded/decrypted by the bubble. MIME isn't in the metadata, so infer
     *  `kind` from the filename extension.
     */
    const m = decoded as MultiRemoteAttachmentView;
    const attachments = (m.attachments ?? []).map((info, i) => {
      const name = (info.filename) ?? `attachment-${i + 1}`;
      const ext = name.split('.').pop()?.toLowerCase() ?? '';
      const kind = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext) ? 'image'
        : ['m4a', 'mp3', 'wav', 'aac', 'ogg'].includes(ext) ? 'audio'
          : ['mp4', 'mov', 'webm'].includes(ext) ? 'video' : 'file';
      return { kind, name, remote: info };
    });
    const first = attachments[0];
    const summary = first !== undefined && attachments.length === 1
      ? `[${first.kind}: ${first.name}]`
      : `[${attachments.length} attachments]`;
    return { ...base, text: summary, payload: { contentType: typeId, attachments } };
  }
  /** Unknown / unsupported codec — render fallback if the codec provided one. */
  return { ...base, text: msg.fallback ?? `[${typeId} payload]`, payload: { contentType: typeId } };
}
