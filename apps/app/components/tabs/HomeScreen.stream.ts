/** HomeScreen message-stream reducer — turns each streamed DecodedMessage into a
 *  per-row update (lastTs/preview/avatar/unread). Extracted from HomeScreen.tsx
 *  (phase-2 lint, behaviour identical). */

import { isMetroControlBody, presentInboundNotification } from '../../lib/push';
import { previewOfXmtpContent } from '@metro-labs/client/xmtp/humanize';
import { getPeerName } from '../../lib/peerProfiles';
import { isActiveConv } from '../../lib/activeConv';
import { shortAddress } from '../../lib/xmtp';
import type { Row as RowT } from './HomeScreen.helpers';
import { convIdFromTopic } from './HomeScreen.helpers';

interface StreamedMsg {
  id?: string;
  content: () => unknown;
  contentTypeId?: string;
  sentNs?: number;
  senderInboxId?: string;
}

/** De-dupe guard: the same DecodedMessage can be delivered more than once (the
 *  native stream re-arm + an AppState-resume resync can both surface it), and
 *  we must never post two cards for one message. Tracks the last N notified
 *  message ids; bounded so it can't grow unbounded over a long session. */
const notifiedMsgIds = new Set<string>();
function alreadyNotified(id: string): boolean {
  if (notifiedMsgIds.has(id)) return true;
  notifiedMsgIds.add(id);
  if (notifiedMsgIds.size > 200) {
    const oldest = notifiedMsgIds.values().next().value;
    if (oldest !== undefined) notifiedMsgIds.delete(oldest);
  }
  return false;
}

/** Conversation context captured from the matched row for the foreground rich
 *  notification (resolved inside setRows, consumed just after). */
interface NotifyCtx {
  title: string;
  senderAddr: string | null;
  isGroup: boolean;
  fromSelf: boolean;
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
      /** Captured from the matched row so the foreground rich-notification path
       *  (below, outside setRows) has the conversation context without a second
       *  lookup. Null until a row matches. */
      let notify: NotifyCtx | null = null;
      setRows(prev => {
        if (!prev) return prev;
        const idx = msgConvId ? prev.findIndex(r => r.convId === msgConvId) : -1;
        if (idx === -1) { needsRefresh = true; return prev; }
        const cur = prev[idx]!;
        const senderAddr = cur.inboxToAddr[msg.senderInboxId ?? ''] ?? null;
        notify = {
          title: cur.title,
          senderAddr,
          isGroup: cur.peerAddress == null,
          fromSelf: msg.senderInboxId === cur.selfInboxId,
        };
        /** DM cards are pinned to the PEER's avatar — never the latest sender.
         *  GROUP cards are pinned to the group's OWN avatar (uploaded image via
         *  avatarUri, else the channel-id stamp seed already set on the row) —
         *  never a member's stamp. So a new inbound never flips the avatar:
         *  DM keeps the peer, group keeps its stable seed (cur.avatarAddress). */
        const newAvatar = cur.peerAddress ?? cur.avatarAddress;
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
      maybeNotify(notify, msgConvId, msg.id, lastPreview);
    })();
  };
}

/** FOREGROUND RICH NOTIFICATION: the app is warm and the message arrived on the
 *  live decrypted stream, so post a real sender + preview card (the native FCM
 *  service is skipping its generic one while foregrounded — see setAppForeground).
 *  Suppressed when it's our own message, when the user is viewing this exact
 *  conversation (isActiveConv mirrors the native active-conv suppression), or
 *  when we already notified this message id (de-dupe). DMs title with the peer
 *  (name / short addr); groups title with the group + prefix the sender. */
function maybeNotify(
  n: NotifyCtx | null, convId: string | null, msgId: string | undefined, preview: string,
): void {
  if (!n || n.fromSelf || !convId || isActiveConv(convId)) return;
  if (msgId && alreadyNotified(msgId)) return;
  const senderName = getPeerName(n.senderAddr)
    ?? (n.senderAddr ? shortAddress(n.senderAddr) : 'New message');
  const title = n.isGroup ? n.title : (getPeerName(n.senderAddr) ?? n.title);
  const body = n.isGroup ? `${senderName}: ${preview}` : preview;
  void presentInboundNotification({ title, body, convId, messageId: msgId });
}
