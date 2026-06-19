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
import { type XmtpClient, syncPreferences, streamConvConsent } from './xmtp';
import { cachedRows, setCachedRows, applyConsentToRows } from './channelsCache';
import { summarizeConv, type ChannelRow } from './channelsSummarize';
import { previewOfXmtpContent } from '@stage-labs/client/xmtp/humanize';

interface StreamHandle { end: () => Promise<unknown> }

export interface ChannelStreamHandles {
  stop: () => Promise<void>;
  /** Manual refresh — exposed so the Refresh button / pull-to-refresh
   *  control can drive it without re-binding to the underlying streams. */
  refresh: () => Promise<void>;
}

/** Start the live channels-list pipeline (new convs, inbound messages, periodic resync) and return its stop/refresh handles. */
export async function startChannelStream(client: XmtpClient): Promise<ChannelStreamHandles> {
  const selfInboxId = client.inboxId ?? '';

  /** A full refresh re-summarises every conversation — `messages()` + per-member
   *  inbox-state resolution per conv — which is the call pattern that previously
   *  drained the XMTP read rate limit. The live streams below cover real-time
   *  updates, so a full refresh is only a backstop: debounce the automatic callers
   *  (visibility + poll + peer-conv fallback) to at most once per window, while
   *  letting an explicit user action (`force`) always run. */
  let lastRefreshAt = 0;
  const MIN_AUTO_REFRESH_MS = 20_000;
  /** Refresh helper. */
  const refresh = async (force = false): Promise<void> => {
    if (!force && Date.now() - lastRefreshAt < MIN_AUTO_REFRESH_MS) return;
    lastRefreshAt = Date.now();
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
  let stopConsentStream: (() => Promise<void>) | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let visibilityHandler: (() => void) | null = null;

  /** Pull synced consent from the network before the first summarise so
   *  cross-device read/unread state is reflected from the start. */
  await syncPreferences();
  await refresh(true);

  stopConvStream = await client.conversations.stream({
    onValue: (conv: Conversation | undefined) => {
      if (!conv) return;
      void (async () => {
        const r = await summarizeConv(conv, selfInboxId);
        const prev = (cachedRows.value as ChannelRow[] | null) ?? [];
        setCachedRows([r, ...prev.filter(x => x.convId !== r.convId)]);
      })();
    },
    onError: () => { /* backstops will resync */ },
  });

  stopMsgStream = await client.conversations.streamAllMessages({
    onValue: (msg) => {
      if (!msg) return;
      const preview = previewOfXmtpContent(msg.content, msg.contentType?.typeId);
      const lastTs = Number(msg.sentAtNs / 1_000_000n);
      const lastPreview = preview.slice(0, 80);
      const prev = (cachedRows.value as ChannelRow[] | null) ?? [];
      const idx = prev.findIndex(r => r.convId === msg.conversationId);
      const cur = idx === -1 ? undefined : prev[idx];
      if (cur === undefined) { void refresh(); return; }
      const newAvatar = cur.inboxToAddr[msg.senderInboxId ?? ''] ?? cur.avatarAddress;
      const sentNs = Number(msg.sentAtNs);
      const isUnread = sentNs > cur.lastReadNs && msg.senderInboxId !== cur.selfInboxId;
      const unreadCount = isUnread ? cur.unreadCount + 1 : cur.unreadCount;
      const updated: ChannelRow = { ...cur, lastTs, lastPreview, avatarAddress: newAvatar, unreadCount };
      /** A real inbound message supersedes a stale forced-unread flag. */
      if (isUnread) updated.markedUnread = false;
      setCachedRows([updated, ...prev.slice(0, idx), ...prev.slice(idx + 1)]);
    },
    onError: () => { /* backstops fire */ },
  });

  /** Cross-device read/unread: live consent changes from another installation
   *  reconcile the badge here. */
  stopConsentStream = await streamConvConsent((convId, state) => {
    applyConsentToRows(convId, state === 'unknown');
  });

  visibilityHandler = (): void => {
    if (document.visibilityState === 'visible') { void syncPreferences(); void refresh(); }
  };
  document.addEventListener('visibilitychange', visibilityHandler);
  /** Backstop poll for dropped streams — every 5min, not 30s. The live streams
   *  handle real-time updates; this just catches anything they missed. */
  pollTimer = setInterval(() => { void refresh(); }, 300_000);

  return {
    /** Manual pull-to-refresh / button: always force a fresh full re-summarise. */
    refresh: () => refresh(true),
    stop: async (): Promise<void> => {
      try { await stopConvStream?.end(); } catch { /* ignore */ }
      try { await stopMsgStream?.end(); } catch { /* ignore */ }
      try { await stopConsentStream?.(); } catch { /* ignore */ }
      if (pollTimer) clearInterval(pollTimer);
      if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler);
    },
  };
}
