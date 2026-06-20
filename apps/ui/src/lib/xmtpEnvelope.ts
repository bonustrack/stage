/** @file Maps decoded XMTP messages to HistoryEntry envelopes and aggregates per-message reaction counts; split out of `xmtpFeed.ts` (and re-exported there) to stay under the lint cap. */

import {
  ReactionAction,
  type DecodedMessage,
  type Reaction, type Attachment as AttachmentContent,
} from '@xmtp/browser-sdk';
import { XMTP_USER_PREFIX } from './xmtp';
import { previewOfXmtpContent } from '@stage-labs/client/xmtp/humanize';
import type { HistoryEntry } from './types';

/** Reduce reaction events to the latest emit-or-removal state per (msgId, emoji, sender) key. */
function latestReactionStates(events: HistoryEntry[]): Map<string, { ts: string; removed: boolean }> {
  const latest = new Map<string, { ts: string; removed: boolean }>();
  for (const e of events) {
    const p = e.payload as { reactTo?: string; emoji?: string; removed?: boolean } | undefined;
    if (!p?.reactTo || !p.emoji) continue;
    const k = `${p.reactTo} ${p.emoji} ${e.from}`;
    const cur = latest.get(k);
    if (!cur || cur.ts < e.ts) latest.set(k, { ts: e.ts, removed: !!p.removed });
  }
  return latest;
}

/** Per-message reaction counts derived from the latest emit-or-removal of each (msgId, emoji, sender) triplet. The same emoji from the same sender replaces its previous state — XMTP reactions are a CRDT, not an append log. */
export function reactionsByMessage(events: HistoryEntry[]): Map<string, Map<string, number>> {
  const latest = latestReactionStates(events);
  const out = new Map<string, Map<string, number>>();
  for (const [k, v] of latest) {
    if (v.removed) continue;
    const [msgId, emoji] = k.split(' ');
    if (msgId === undefined || emoji === undefined) continue;
    let m = out.get(msgId);
    if (!m) { m = new Map(); out.set(msgId, m); }
    m.set(emoji, (m.get(emoji) ?? 0) + 1);
  }
  return out;
}

/** True when a history entry is a reaction rather than a standalone message. */
export function isReactionEntry(e: HistoryEntry): boolean {
  return Boolean((e.payload as { reactTo?: string } | undefined)?.reactTo);
}

/** Bytes To Base64. */
function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

/** Build a reaction envelope from the decoded reaction content. */
function reactionEnvelope(base: HistoryEntry, typeId: string, decoded: object): HistoryEntry {
  const r = decoded as Reaction;
  const removed = r.action === ReactionAction.Removed;
  return {
    ...base,
    text: `[react ${r.content}${removed ? ' (removed)' : ''}]`,
    payload: { contentType: typeId, reactTo: r.reference, emoji: r.content, removed },
  };
}

/** Build a reply envelope from the decoded reply content. */
function replyEnvelope(base: HistoryEntry, typeId: string, decoded: object): HistoryEntry {
  /** browser-sdk enriches replies — `content` is the inner decoded payload plus a `referenceId` pointing back at the target message id. */
  const r = decoded as { referenceId: string; content: unknown };
  const innerText = typeof r.content === 'string' ? r.content : undefined;
  return {
    ...base,
    text: innerText ?? '[reply]',
    replyTo: r.referenceId,
    payload: { contentType: typeId, replyTo: r.referenceId },
  };
}

/** Classify an attachment mime type into a bubble kind. */
function attachmentKind(mime: string | undefined): 'image' | 'audio' | 'video' | 'file' {
  if (mime?.startsWith('image/')) return 'image';
  if (mime?.startsWith('audio/')) return 'audio';
  if (mime?.startsWith('video/')) return 'video';
  return 'file';
}

/** Build an attachment envelope from the decoded attachment content. */
function attachmentEnvelope(base: HistoryEntry, typeId: string, decoded: object): HistoryEntry {
  const a = decoded as AttachmentContent;
  const kind = attachmentKind(a.mimeType);
  return {
    ...base,
    text: `[${kind}: ${a.filename ?? 'attachment'}]`,
    payload: {
      contentType: typeId,
      attachments: [{ kind, mime: a.mimeType, name: a.filename, dataB64: bytesToBase64(a.content) }],
    },
  };
}

/** Build the fallback envelope for group-update or otherwise unhandled content types. */
function fallbackEnvelope(base: HistoryEntry, typeId: string, decoded: unknown, fallback?: string): HistoryEntry {
  const isGroupUpdate = typeId === 'group_updated' || typeId === 'groupUpdated';
  const text = isGroupUpdate ? previewOfXmtpContent(decoded, typeId) : (fallback ?? `[${typeId} payload]`);
  return { ...base, text, payload: { contentType: typeId, ...(isGroupUpdate ? { system: true } : {}) } };
}

/** Convert a decoded XMTP message into the shared `HistoryEntry` envelope so the bubble renderer doesn't need to know which transport it came from. */
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
  /** `contentType.typeId` is e.g. `"text"`, `"reaction"`, `"reply"`, `"attachment"`. */
  const typeId = msg.contentType.typeId;
  const decoded: unknown = msg.content;
  if (typeof decoded === 'string') {
    return { ...base, text: decoded, payload: { contentType: typeId } };
  }
  if (decoded && typeof decoded === 'object') {
    if (typeId === 'reaction') return reactionEnvelope(base, typeId, decoded);
    if (typeId === 'reply') return replyEnvelope(base, typeId, decoded);
    if (typeId === 'attachment') return attachmentEnvelope(base, typeId, decoded);
  }
  return fallbackEnvelope(base, typeId, decoded, msg.fallback);
}
