
import {
  ReactionAction,
  type DecodedMessage,
  type Reaction, type Attachment as AttachmentContent,
} from '@xmtp/browser-sdk';
import { XMTP_USER_PREFIX } from './xmtp';
import { previewOfXmtpContent } from '@stage-labs/client/xmtp/humanize';
import type { HistoryEntry } from './types';

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

export function isReactionEntry(e: HistoryEntry): boolean {
  return Boolean((e.payload as { reactTo?: string } | undefined)?.reactTo);
}

function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function reactionEnvelope(base: HistoryEntry, typeId: string, decoded: object): HistoryEntry {
  const r = decoded as Reaction;
  const removed = r.action === ReactionAction.Removed;
  return {
    ...base,
    text: `[react ${r.content}${removed ? ' (removed)' : ''}]`,
    payload: { contentType: typeId, reactTo: r.reference, emoji: r.content, removed },
  };
}

function replyEnvelope(base: HistoryEntry, typeId: string, decoded: object): HistoryEntry {
  const r = decoded as { referenceId: string; content: unknown };
  const innerText = typeof r.content === 'string' ? r.content : undefined;
  return {
    ...base,
    text: innerText ?? '[reply]',
    replyTo: r.referenceId,
    payload: { contentType: typeId, replyTo: r.referenceId },
  };
}

function attachmentKind(mime: string | undefined): 'image' | 'audio' | 'video' | 'file' {
  if (mime?.startsWith('image/')) return 'image';
  if (mime?.startsWith('audio/')) return 'audio';
  if (mime?.startsWith('video/')) return 'video';
  return 'file';
}

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

function fallbackEnvelope(base: HistoryEntry, typeId: string, decoded: unknown, fallback?: string): HistoryEntry {
  const isGroupUpdate = typeId === 'group_updated' || typeId === 'groupUpdated';
  const text = isGroupUpdate ? previewOfXmtpContent(decoded, typeId) : (fallback ?? `[${typeId} payload]`);
  return { ...base, text, payload: { contentType: typeId, ...(isGroupUpdate ? { system: true } : {}) } };
}

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
