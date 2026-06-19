/**
 * @file Maps decoded XMTP messages to HistoryEntry envelopes and aggregates per-message reaction counts.
 */
/** Decoded XMTP message → HistoryEntry envelope + reaction aggregation. Split out of `xmtpFeed.ts` so each file stays under the lint cap; re-exported from there. */

import {
  ReactionAction,
  type DecodedMessage,
  type Reaction, type Attachment as AttachmentContent,
} from '@xmtp/browser-sdk';
import { XMTP_USER_PREFIX } from './xmtp';
import { previewOfXmtpContent } from '@stage-labs/client/xmtp/humanize';
import type { HistoryEntry } from './types';

/** Per-message reaction counts derived from the latest emit-or-removal of each (msgId, emoji, sender) triplet. The same emoji from the same sender replaces its previous state — XMTP reactions are a CRDT, not an append log. */
export function reactionsByMessage(events: HistoryEntry[]): Map<string, Map<string, number>> {
  const latest = new Map<string, { ts: string; removed: boolean }>();
  for (const e of events) {
    const p = e.payload as { reactTo?: string; emoji?: string; removed?: boolean } | undefined;
    if (!p?.reactTo || !p.emoji) continue;
    const k = `${p.reactTo} ${p.emoji} ${e.from}`;
    const cur = latest.get(k);
    if (!cur || cur.ts < e.ts) latest.set(k, { ts: e.ts, removed: !!p.removed });
  }
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
  if (typeId === 'reaction' && decoded && typeof decoded === 'object') {
    const r = decoded as Reaction;
    const removed = r.action === ReactionAction.Removed;
    return {
      ...base,
      text: `[react ${r.content}${removed ? ' (removed)' : ''}]`,
      payload: { contentType: typeId, reactTo: r.reference, emoji: r.content, removed },
    };
  }
  if (typeId === 'reply' && decoded && typeof decoded === 'object') {
    /** browser-sdk enriches replies — `content` is the inner decoded payload plus a `referenceId` pointing back at the target message id. */
    const r = decoded as { referenceId: string; content: unknown };
    const innerText = typeof r.content === 'string' ? r.content : undefined;
    return {
      ...base,
      text: innerText ?? `[reply]`,
      replyTo: r.referenceId,
      payload: { contentType: typeId, replyTo: r.referenceId },
    };
  }
  if (typeId === 'attachment' && decoded && typeof decoded === 'object') {
    const a = decoded as AttachmentContent;
    const kind = a.mimeType?.startsWith('image/') ? 'image'
      : a.mimeType?.startsWith('audio/') ? 'audio'
        : a.mimeType?.startsWith('video/') ? 'video' : 'file';
    return {
      ...base,
      text: `[${kind}: ${a.filename ?? 'attachment'}]`,
      payload: {
        contentType: typeId,
        attachments: [{ kind, mime: a.mimeType, name: a.filename, dataB64: bytesToBase64(a.content) }],
      },
    };
  }
  const isGroupUpdate = typeId === 'group_updated' || typeId === 'groupUpdated';
  const text = isGroupUpdate ? previewOfXmtpContent(decoded, typeId) : (msg.fallback ?? `[${typeId} payload]`);
  return { ...base, text, payload: { contentType: typeId, ...(isGroupUpdate ? { system: true } : {}) } };
}
