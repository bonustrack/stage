/**
 * @file HomeScreen.stream — the message-stream handler that turns each streamed
 *  DecodedMessage into a per-row update (lastTs/preview/avatar/unread), with a
 *  de-dupe guard, extracted from HomeScreen.tsx.
 */

import { isMetroControlBody, presentInboundNotification } from '../../lib/push';
import { previewOfXmtpContent } from '@stage-labs/client/xmtp/humanize';
import { getPeerName } from '../../lib/peerProfiles';
import { isActiveConv } from '../../lib/activeConv';
import { shortAddress, getConvConsentState } from '../../modules/messaging';
import type { Row as RowT } from './HomeScreen.helpers';
import { convIdFromTopic } from './HomeScreen.helpers';

interface StreamedMsg {
  id?: string;
  content: () => unknown;
  contentTypeId?: string;
  sentNs?: number;
  senderInboxId?: string;
}

/**
 * De-dupe guard: the same DecodedMessage can be delivered more than once (the
 *  native stream re-arm + an AppState-resume resync can both surface it), and
 *  we must never post two cards for one message. Tracks the last N notified
 *  message ids; bounded so it can't grow unbounded over a long session.
 */
const notifiedMsgIds = new Set<string>();
/** Already Notified. */
function alreadyNotified(id: string): boolean {
  if (notifiedMsgIds.has(id)) return true;
  notifiedMsgIds.add(id);
  if (notifiedMsgIds.size > 200) {
    const oldest = notifiedMsgIds.values().next().value;
    if (oldest !== undefined) notifiedMsgIds.delete(oldest);
  }
  return false;
}

/** Conversation context captured from the matched row for the foreground rich notification (resolved inside setRows, consumed just after). */
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
  /** Recount pending requests ('unknown' consent) without a full inbox refresh — used for messages in not-yet-accepted convs. */
  refreshRequestCount: () => Promise<void>;
}

/**
 * STREAM-MISS REFRESH COALESCER. A streamed message whose convId isn't in the
 *  current rows triggers a refresh. Messages in PENDING-REQUEST convs (consent
 *  'unknown') ALWAYS miss — rows only hold 'allowed' convs — so without this
 *  every such message fired a full N+1 inbox refresh forever.
 *
 *  - Single-flight + ~1s trailing debounce so a miss burst coalesces into ONE
 *    full refresh instead of one-per-message.
 *  - For 'unknown' convs, skip the full refresh entirely: just bump the request
 *    count/preview (cheap local recount).
 *
 *  Build a per-subscription coalescer so it resets on account switch (the
 *  handler is rebuilt then).
 */
function makeMissRefresher(
  isCancelled: () => boolean,
  refresh: () => Promise<void>,
  refreshRequestCount: () => Promise<void>,
) {
  // `number` (RN timer id): @types/node's Timeout collides with DOM at clear*().
  let missTimer: number | null = null;
  let refreshInFlight = false;

  /** Run the full refresh single-flight: if one is already running, the trailing timer re-fires after it, so a miss during the refresh isn't dropped. */
  const runRefresh = (): void => {
    if (refreshInFlight) { armFullRefresh(); return; }
    refreshInFlight = true;
    void refresh().finally(() => { refreshInFlight = false; });
  };
  /** Arm Full Refresh. */
  function armFullRefresh(): void {
    if (missTimer) clearTimeout(missTimer);
    missTimer = setTimeout(() => {
      missTimer = null;
      if (!isCancelled()) runRefresh();
    }, 1_000) as unknown as number;
  }

  /** Handle a convId miss. For 'unknown'-consent convs (pending requests) only recount requests; otherwise debounce a full refresh. Consent is read from the LOCAL conv handle (no network) so the check is cheap. */
  return (convId: string | null): void => {
    void (async (): Promise<void> => {
      if (convId) {
        const consent = await getConvConsentState(convId).catch(() => null);
        if (consent === 'unknown') { void refreshRequestCount(); return; }
      }
      if (!isCancelled()) armFullRefresh();
    })();
  };
}

/**
 * Build the subscribeAllMessages callback. Owns all the channel-row /
 *  unread-count / cache work for an inbound message.
 *
 *  The JS local-notification path was REMOVED here: the daemon + native
 *  MetroFcmService are now the SINGLE source of inbound push notifications
 *  (one merged MessagingStyle card per conversation). This handler only updates
 *  the list. An account with no daemon push registration gets no notifications,
 *  which is acceptable (the daemon pushes for the active account).
 */
export function makeMsgStreamHandler({ isCancelled, setRows, refresh, refreshRequestCount }: MsgHandlerDeps) {
  const onMiss = makeMissRefresher(isCancelled, refresh, refreshRequestCount);
  return ({ convId: streamConvId, msg }: { convId: string | null; msg: StreamedMsg | null }): void => {
    if (isCancelled() || !msg) return;
    (((): void => {
      let decoded: unknown;
      let preview = '';
      try { decoded = msg.content(); preview = previewOfXmtpContent(decoded, msg.contentTypeId); }
      catch { preview = `[${msg.contentTypeId ?? 'unknown'}]`; }
      /** Our own register-push control DMs ride plain text — ignore them entirely so they neither bump a row nor fire a notification. */
      if (typeof decoded === 'string' && isMetroControlBody(decoded)) return;
      const lastTs = msg.sentNs ? Math.floor(msg.sentNs / 1_000_000) : Date.now();
      const lastPreview = preview.slice(0, 80);

      /** The RN `DecodedMessage` only carries `topic` (e.g. `/xmtp/mls/1/g-<id>/proto`), NOT `conversationId` — so derive the conv id from the topic (with the native `conversationId`, when present, as a fallback). Best-effort: a miss still triggers refresh. */
      const msgConvId = streamConvId
        ?? convIdFromTopic((msg as unknown as { topic?: string }).topic)
        ?? (msg as unknown as { conversationId?: string }).conversationId
        ?? null;

      let needsRefresh = false;
      /** Captured from the matched row so the foreground rich-notification path (below, outside setRows) has the conversation context without a second lookup. Null until a row matches. */
      let notify: NotifyCtx | null = null;
      setRows(prev => {
        if (!prev) return prev;
        const idx = msgConvId ? prev.findIndex(r => r.convId === msgConvId) : -1;
        /** Miss: convId not in rows. Coalesced + consent-aware handling lives in onMiss (pending-request convs only recount; others debounce refresh). */
        const cur = idx === -1 ? undefined : prev[idx];
        if (cur === undefined) { needsRefresh = true; return prev; }
        const senderAddr = cur.inboxToAddr[msg.senderInboxId ?? ''] ?? null;
        notify = {
          title: cur.title,
          senderAddr,
          isGroup: cur.peerAddress == null,
          fromSelf: msg.senderInboxId === cur.selfInboxId,
        };
        /**
         * DM cards are pinned to the PEER's avatar — never the latest sender.
         *  GROUP cards are pinned to the group's OWN avatar (uploaded image via
         *  avatarUri, else the channel-id stamp seed already set on the row) —
         *  never a member's stamp. So a new inbound never flips the avatar:
         *  DM keeps the peer, group keeps its stable seed (cur.avatarAddress).
         */
        const newAvatar = cur.peerAddress ?? cur.avatarAddress;
        /** Attribute the preview to whoever SENT this message — including a reaction (its senderInboxId is the reactor). Without this the row keeps the stale lastSenderAddress from summarize(). */
        const lastFromSelf = msg.senderInboxId === cur.selfInboxId;
        /** Bump unread when the new msg is newer than what we'd read AND not authored by the local user. */
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
      if (needsRefresh) onMiss(msgConvId);
      maybeNotify(notify, msgConvId, msg.id, lastPreview);
    }))();
  };
}

/**
 * FOREGROUND RICH NOTIFICATION: the app is warm and the message arrived on the
 *  live decrypted stream, so post a real sender + preview card (the native FCM
 *  service is skipping its generic one while foregrounded — see setAppForeground).
 *  Suppressed when it's our own message, when the user is viewing this exact
 *  conversation (isActiveConv mirrors the native active-conv suppression), or
 *  when we already notified this message id (de-dupe). DMs title with the peer
 *  (name / short addr); groups title with the group + prefix the sender.
 */
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
