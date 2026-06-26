
import {
  ReactionAction, ReactionSchema,
  type DecodedMessage,
  type Reaction, type Attachment as AttachmentContent,
} from '@xmtp/browser-sdk';
import { XMTP_USER_PREFIX } from './xmtp';
import { envelopeFromContent, type EnvelopeOptions } from '@stage-labs/client/xmtp/envelope';
import type { HistoryEntry } from '@stage-labs/client/types';

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

function latestOwnReactionStates(events: HistoryEntry[], myUri: string): Map<string, { ts: string; removed: boolean }> {
  const latest = new Map<string, { ts: string; removed: boolean }>();
  for (const e of events) {
    const p = e.payload as { reactTo?: string; emoji?: string; removed?: boolean } | undefined;
    if (!p?.reactTo || !p.emoji || e.from !== myUri) continue;
    const k = `${p.reactTo} ${p.emoji}`;
    const cur = latest.get(k);
    if (!cur || cur.ts < e.ts) latest.set(k, { ts: e.ts, removed: !!p.removed });
  }
  return latest;
}

export function ownEmojisByMessage(events: HistoryEntry[], myUri: string): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const [k, v] of latestOwnReactionStates(events, myUri)) {
    if (v.removed) continue;
    const [msgId, emoji] = k.split(' ');
    if (msgId === undefined || emoji === undefined) continue;
    let s = out.get(msgId);
    if (!s) { s = new Set(); out.set(msgId, s); }
    s.add(emoji);
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

function isRemovedAction(action: Reaction['action']): boolean {
  return action === ReactionAction.Removed || (action as unknown) === 'removed';
}

function isCustomSchema(schema: Reaction['schema']): boolean {
  return schema === ReactionSchema.Custom || (schema as unknown) === 'custom';
}

const UI_HANDLERS = new Set([
  'reaction', 'reply', 'attachment', 'poll', 'walletSendCalls', 'signatureRequest',
]);

const uiEnvelopeOptions: EnvelopeOptions = {
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
  handlers: UI_HANDLERS,
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
  return envelopeFromContent(base, typeId, msg.content, msg.fallback, uiEnvelopeOptions);
}
