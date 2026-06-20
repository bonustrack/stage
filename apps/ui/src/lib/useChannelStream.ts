
import type { Conversation } from '@xmtp/browser-sdk';
import { type XmtpClient, syncPreferences, streamConvConsent } from './xmtp';
import { cachedRows, setCachedRows, applyConsentToRows } from './channelsCache';
import { summarizeConv, type ChannelRow } from './channelsSummarize';
import { previewOfXmtpContent } from '@stage-labs/client/xmtp/humanize';

interface StreamHandle { end: () => Promise<unknown> }

interface InboundMsg {
  content: unknown;
  contentType?: { typeId?: string };
  sentAtNs: bigint;
  conversationId?: string;
  senderInboxId?: string;
}

function rowsWithInbound(prev: ChannelRow[], msg: InboundMsg): ChannelRow[] | null {
  const preview = previewOfXmtpContent(msg.content, msg.contentType?.typeId);
  const lastTs = Number(msg.sentAtNs / 1_000_000n);
  const lastPreview = preview.slice(0, 80);
  const idx = prev.findIndex(r => r.convId === msg.conversationId);
  const cur = idx === -1 ? undefined : prev[idx];
  if (cur === undefined) return null;
  const newAvatar = cur.inboxToAddr[msg.senderInboxId ?? ''] ?? cur.avatarAddress;
  const sentNs = Number(msg.sentAtNs);
  const isUnread = sentNs > cur.lastReadNs && msg.senderInboxId !== cur.selfInboxId;
  const unreadCount = isUnread ? cur.unreadCount + 1 : cur.unreadCount;
  const updated: ChannelRow = { ...cur, lastTs, lastPreview, avatarAddress: newAvatar, unreadCount };
  if (isUnread) updated.markedUnread = false;
  return [updated, ...prev.slice(0, idx), ...prev.slice(idx + 1)];
}

export interface ChannelStreamHandles {
  stop: () => Promise<void>;
  refresh: () => Promise<void>;
}

export async function startChannelStream(client: XmtpClient): Promise<ChannelStreamHandles> {
  const selfInboxId = client.inboxId ?? '';

  let lastRefreshAt = 0;
  const MIN_AUTO_REFRESH_MS = 20_000;
  const refresh = async (force = false): Promise<void> => {
    if (!force && Date.now() - lastRefreshAt < MIN_AUTO_REFRESH_MS) return;
    lastRefreshAt = Date.now();
    try {
      await client.conversations.syncAll();
      const convs = await client.conversations.list();
      const summarized = await Promise.all(convs.map(c => summarizeConv(c, selfInboxId)));
      summarized.sort((a, b) => (b.lastTs ?? 0) - (a.lastTs ?? 0));
      setCachedRows(summarized);
    } catch { }
  };

  let stopConvStream: StreamHandle | null = null;
  let stopMsgStream: StreamHandle | null = null;
  let stopConsentStream: (() => Promise<void>) | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let visibilityHandler: (() => void) | null = null;

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
    onError: () => undefined,
  });

  stopMsgStream = await client.conversations.streamAllMessages({
    onValue: (msg) => {
      if (!msg) return;
      const prev = (cachedRows.value as ChannelRow[] | null) ?? [];
      const next = rowsWithInbound(prev, msg);
      if (next === null) { void refresh(); return; }
      setCachedRows(next);
    },
    onError: () => undefined,
  });

  stopConsentStream = await streamConvConsent((convId, state) => {
    applyConsentToRows(convId, state === 'unknown');
  });

  visibilityHandler = (): void => {
    if (document.visibilityState === 'visible') { void syncPreferences(); void refresh(); }
  };
  document.addEventListener('visibilitychange', visibilityHandler);
  pollTimer = setInterval(() => { void refresh(); }, 300_000);

  return {
    refresh: () => refresh(true),
    stop: async (): Promise<void> => {
      try { await stopConvStream?.end(); } catch { }
      try { await stopMsgStream?.end(); } catch { }
      try { await stopConsentStream?.(); } catch { }
      if (pollTimer) clearInterval(pollTimer);
      if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler);
    },
  };
}
