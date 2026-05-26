/** Wire the live-update pipeline for the Channels list:
 *   - subscribe to newly-created conversations (`conversations.stream`)
 *   - subscribe to every inbound message (`streamAllMessages`) and patch
 *     the cached row's preview / timestamp / unread count
 *   - fall back to a full refresh when a message lands for a conv we
 *     haven't summarised yet (peer-initiated)
 *   - re-sync on visibility change + every 30s
 *
 *  Returns the start/stop pair so the calling page binds them to its
 *  Vue lifecycle (onMounted / onUnmounted). */

import type { Conversation } from '@xmtp/browser-sdk';
import { type XmtpClient } from './xmtp';
import { cachedRows, setCachedRows } from './channelsCache';
import { summarizeConv, type ChannelRow } from './channelsSummarize';

type StreamHandle = { end: () => Promise<unknown> };

export interface ChannelStreamHandles {
  stop: () => Promise<void>;
  /** Manual refresh — exposed so the Refresh button / pull-to-refresh
   *  control can drive it without re-binding to the underlying streams. */
  refresh: () => Promise<void>;
}

export async function startChannelStream(client: XmtpClient): Promise<ChannelStreamHandles> {
  const selfInboxId = client.inboxId ?? '';

  const refresh = async (): Promise<void> => {
    try {
      await client.conversations.syncAll();
      const convs = await client.conversations.list();
      const summarized = await Promise.all(convs.map(c => summarizeConv(c, selfInboxId)));
      summarized.sort((a, b) => (b.lastTs ?? 0) - (a.lastTs ?? 0));
      setCachedRows(summarized);
    } catch { /* swallow — backstops fire */ }
  };

  let stopConvStream: StreamHandle | null = null;
  let stopMsgStream: StreamHandle | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let visibilityHandler: (() => void) | null = null;

  await refresh();

  stopConvStream = await client.conversations.stream({
    onValue: async (conv: Conversation | undefined) => {
      if (!conv) return;
      const r = await summarizeConv(conv, selfInboxId);
      const prev = (cachedRows.value as ChannelRow[] | null) ?? [];
      setCachedRows([r, ...prev.filter(x => x.convId !== r.convId)]);
    },
    onError: () => { /* backstops will resync */ },
  });

  stopMsgStream = await client.conversations.streamAllMessages({
    onValue: async (msg) => {
      if (!msg) return;
      const decoded: unknown = msg.content;
      const preview = typeof decoded === 'string'
        ? decoded
        : `[${msg.contentType?.typeId ?? 'unknown'}]`;
      const lastTs = Number(msg.sentAtNs / 1_000_000n);
      const lastPreview = preview.slice(0, 80);
      const prev = (cachedRows.value as ChannelRow[] | null) ?? [];
      const idx = prev.findIndex(r => r.convId === msg.conversationId);
      if (idx === -1) { void refresh(); return; }
      const cur = prev[idx]!;
      const newAvatar = cur.inboxToAddr[msg.senderInboxId ?? ''] ?? cur.avatarAddress;
      const sentNs = Number(msg.sentAtNs);
      const isUnread = sentNs > cur.lastReadNs && msg.senderInboxId !== cur.selfInboxId;
      const unreadCount = isUnread ? cur.unreadCount + 1 : cur.unreadCount;
      const updated: ChannelRow = { ...cur, lastTs, lastPreview, avatarAddress: newAvatar, unreadCount };
      setCachedRows([updated, ...prev.slice(0, idx), ...prev.slice(idx + 1)]);
    },
    onError: () => { /* backstops fire */ },
  });

  visibilityHandler = (): void => {
    if (document.visibilityState === 'visible') void refresh();
  };
  document.addEventListener('visibilitychange', visibilityHandler);
  pollTimer = setInterval(() => { void refresh(); }, 30_000);

  return {
    refresh,
    stop: async (): Promise<void> => {
      try { await stopConvStream?.end(); } catch { /* ignore */ }
      try { await stopMsgStream?.end(); } catch { /* ignore */ }
      if (pollTimer) clearInterval(pollTimer);
      if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler);
    },
  };
}
