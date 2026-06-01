/** HomeScreen message-stream reducer — turns each streamed DecodedMessage into a
 *  per-row update (lastTs/preview/avatar/unread). Extracted from HomeScreen.tsx
 *  (phase-2 lint, behaviour identical). */

import { isMetroControlBody } from '../../lib/push';
import { previewOfXmtpContent } from '@metro-labs/client/xmtp/humanize';
import type { Row as RowT } from './HomeScreen.helpers';
import { convIdFromTopic } from './HomeScreen.helpers';

interface StreamedMsg {
  content: () => unknown;
  contentTypeId?: string;
  sentNs?: number;
  senderInboxId?: string;
}

interface MsgHandlerDeps {
  isCancelled: () => boolean;
  setRows: (next: (p: RowT[] | null) => RowT[] | null) => void;
  refresh: () => Promise<void>;
}

/** Build the subscribeAllMessages callback. Owns all the channel-row /
 *  unread-count / cache work for an inbound message.
 *
 *  The JS local-notification path was REMOVED here: the daemon + native
 *  MetroFcmService are now the SINGLE source of inbound push notifications
 *  (one merged MessagingStyle card per conversation). This handler only updates
 *  the list. An account with no daemon push registration gets no notifications,
 *  which is acceptable (the daemon pushes for the active account). */
export function makeMsgStreamHandler({ isCancelled, setRows, refresh }: MsgHandlerDeps) {
  return ({ convId: streamConvId, msg }: { convId: string | null; msg: StreamedMsg | null }): void => {
    if (isCancelled() || !msg) return;
    void (async (): Promise<void> => {
      let decoded: unknown;
      let preview = '';
      try { decoded = msg.content(); preview = previewOfXmtpContent(decoded, msg.contentTypeId); }
      catch { preview = `[${msg.contentTypeId ?? 'unknown'}]`; }
      /** Our own register-push control DMs ride plain text — ignore them
       *  entirely so they neither bump a row nor fire a notification. */
      if (typeof decoded === 'string' && isMetroControlBody(decoded)) return;
      const lastTs = msg.sentNs ? Math.floor(msg.sentNs / 1_000_000) : Date.now();
      const lastPreview = preview.slice(0, 80);

      /** The RN `DecodedMessage` only carries `topic` (e.g.
       *  `/xmtp/mls/1/g-<id>/proto`), NOT `conversationId` — so derive the
       *  conv id from the topic (with the native `conversationId`, when
       *  present, as a fallback). Best-effort: a miss still triggers refresh. */
      const msgConvId = streamConvId
        ?? convIdFromTopic((msg as unknown as { topic?: string }).topic)
        ?? (msg as unknown as { conversationId?: string }).conversationId
        ?? null;

      let needsRefresh = false;
      setRows(prev => {
        if (!prev) return prev;
        const idx = msgConvId ? prev.findIndex(r => r.convId === msgConvId) : -1;
        if (idx === -1) { needsRefresh = true; return prev; }
        const cur = prev[idx]!;
        const senderAddr = cur.inboxToAddr[msg.senderInboxId ?? ''] ?? null;
        /** DM cards are pinned to the PEER's avatar — never the latest sender.
         *  Otherwise a message from self (or the shared-inbox daemon) would
         *  flip the card to the local user's own avatar. Groups still track the
         *  latest sender's stamp. */
        const newAvatar = cur.peerAddress ?? senderAddr ?? cur.avatarAddress;
        /** Attribute the preview to whoever SENT this message — including a
         *  reaction (its senderInboxId is the reactor). Without this the row
         *  keeps the stale lastSenderAddress from summarize(). */
        const lastFromSelf = msg.senderInboxId === cur.selfInboxId;
        /** Bump unread when the new msg is newer than what we'd read AND not
         *  authored by the local user. */
        const isUnread = (msg.sentNs ?? 0) > cur.lastReadNs
          && msg.senderInboxId !== cur.selfInboxId;
        const unreadCount = isUnread ? cur.unreadCount + 1 : cur.unreadCount;
        const updated = {
          ...cur, lastTs, lastPreview, avatarAddress: newAvatar,
          lastSenderAddress: senderAddr, lastFromSelf, unreadCount,
        };
        /** A real inbound message supersedes a stale forced-unread flag. */
        if (isUnread) updated.markedUnread = false;
        return [updated, ...prev.slice(0, idx), ...prev.slice(idx + 1)];
      });
      if (needsRefresh) void refresh();
    })();
  };
}
