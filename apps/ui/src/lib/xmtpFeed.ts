/** XMTP live-feed composable + decoded-message → HistoryEntry envelope. Split out of
 *  `xmtp.ts` so each file stays under the lint cap. */

import { ref, watch, onUnmounted, type Ref } from 'vue';
import {
  ReactionAction,
  type DecodedMessage,
  type Reaction, type Attachment as AttachmentContent,
} from '@xmtp/browser-sdk';
import {
  XMTP_USER_PREFIX, getOrCreateXmtpClient, convOfLine,
} from './xmtp';
import { previewOfXmtpContent } from '@shared/xmtp/humanize';
import type { HistoryEntry } from './types';

/** Per-message reaction counts derived from the latest emit-or-removal of each
 *  (msgId, emoji, sender) triplet. The same emoji from the same sender replaces its
 *  previous state — XMTP reactions are a CRDT, not an append log. */
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

/** Convert a decoded XMTP message into the shared `HistoryEntry` envelope so the
 *  bubble renderer doesn't need to know which transport it came from. */
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
    /** browser-sdk enriches replies — `content` is the inner decoded payload plus a
     *  `referenceId` pointing back at the target message id. */
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
  return { ...base, text, payload: { contentType: typeId } };
}

export type XmtpFeedStatus = 'idle' | 'loading' | 'open' | 'error';

export interface XmtpFeedHandle {
  events: Ref<HistoryEntry[]>;
  status: Ref<XmtpFeedStatus>;
  error: Ref<string | null>;
  inboxId: Ref<string>;
}

/** Vue composable: load a conversation's history then subscribe to its live stream.
 *  Events are returned newest-first so an inverted list can consume them unchanged.
 *  Pass `enabled=false` while the client is still booting to keep the feed idle. */
export function useXmtpFeed(line: Ref<string | null>, enabled: Ref<boolean>): XmtpFeedHandle {
  const events = ref<HistoryEntry[]>([]);
  const status = ref<XmtpFeedStatus>('idle');
  const error = ref<string | null>(null);
  const inboxId = ref<string>('');

  let cancelled = false;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let streamCloser: { return?: () => Promise<unknown> } | null = null;
  let onVisibility: (() => void) | null = null;
  let activeLine: string | null = null;

  const teardown = (): void => {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    if (streamCloser?.return) { void streamCloser.return().catch(() => undefined); streamCloser = null; }
    if (onVisibility) { document.removeEventListener('visibilitychange', onVisibility); onVisibility = null; }
  };

  const refresh = async (): Promise<void> => {
    const current = activeLine;
    if (!current) return;
    try {
      const conv = await convOfLine(current);
      if (!conv || cancelled || activeLine !== current) return;
      await conv.sync().catch(() => undefined);
      const msgs = await conv.messages({ limit: 100n });
      if (cancelled || activeLine !== current) return;
      /** `messages()` is oldest-first; flip for inverted feed. */
      const fresh = msgs.map(m => envelopeOfXmtpMessage(m, current)).reverse();
      if (events.value.length === 0) { events.value = fresh; return; }
      const seen = new Set(events.value.map(e => e.id));
      const additions = fresh.filter(e => !seen.has(e.id));
      if (additions.length) events.value = [...additions, ...events.value];
    } catch { /* next tick or visibility flip retries */ }
  };

  const start = async (): Promise<void> => {
    if (!enabled.value || !line.value) { status.value = 'idle'; return; }
    activeLine = line.value;
    cancelled = false;
    status.value = 'loading';
    error.value = null;
    events.value = [];
    try {
      const client = await getOrCreateXmtpClient('production');
      if (cancelled || activeLine !== line.value) return;
      inboxId.value = client.inboxId ?? '';
      await refresh();
      status.value = 'open';
      try {
        const conv = await convOfLine(activeLine);
        if (conv && !cancelled) {
          const stream = await conv.stream({
            onValue: (msg) => {
              if (cancelled || !msg || activeLine === null) return;
              const env = envelopeOfXmtpMessage(msg, activeLine);
              if (!events.value.some(e => e.id === env.id)) {
                events.value = [env, ...events.value];
              }
            },
          });
          streamCloser = stream as unknown as { return?: () => Promise<unknown> };
        }
      } catch { /* stream init failed — poll backstop keeps the feed fresh */ }
      onVisibility = (): void => { if (document.visibilityState === 'visible') void refresh(); };
      document.addEventListener('visibilitychange', onVisibility);
      pollTimer = setInterval(() => { void refresh(); }, 5_000);
    } catch (e) {
      if (cancelled) return;
      status.value = 'error';
      error.value = (e as Error).message;
    }
  };

  const restart = (): void => { cancelled = true; teardown(); void start(); };

  void start();
  const stopWatch = watch([line, enabled], restart);
  onUnmounted(() => { cancelled = true; teardown(); stopWatch(); });

  return { events, status, error, inboxId };
}
