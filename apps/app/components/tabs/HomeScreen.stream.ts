
import { isMetroControlBody, presentInboundNotification } from '../../lib/push';
import { previewOfXmtpContent } from '@stage-labs/client/xmtp/humanize';
import { getPeerName } from '../../lib/peerProfiles';
import { isActiveConv } from '../../lib/activeConv';
import { shortAddress, getConvConsentState } from '../../modules/messaging';
import type { Row as RowT } from './HomeScreen.helpers';
import { convIdFromTopic } from '@stage-labs/client/xmtp/clientErrors';

interface StreamedMsg {
  id?: string;
  content: () => unknown;
  contentTypeId?: string;
  sentNs?: number;
  senderInboxId?: string;
}

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
  refreshRequestCount: () => Promise<void>;
}

function makeMissRefresher(
  isCancelled: () => boolean,
  refresh: () => Promise<void>,
  refreshRequestCount: () => Promise<void>,
) {
  let missTimer: number | null = null;
  let refreshInFlight = false;

  const runRefresh = (): void => {
    if (refreshInFlight) { armFullRefresh(); return; }
    refreshInFlight = true;
    void refresh().finally(() => { refreshInFlight = false; });
  };
  function armFullRefresh(): void {
    if (missTimer) clearTimeout(missTimer);
    missTimer = setTimeout(() => {
      missTimer = null;
      if (!isCancelled()) runRefresh();
    }, 1_000) as unknown as number;
  }

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

export function makeMsgStreamHandler({ isCancelled, setRows, refresh, refreshRequestCount }: MsgHandlerDeps) {
  const onMiss = makeMissRefresher(isCancelled, refresh, refreshRequestCount);
  return ({ convId: streamConvId, msg }: { convId: string | null; msg: StreamedMsg | null }): void => {
    if (isCancelled() || !msg) return;
    (((): void => {
      let decoded: unknown;
      let preview = '';
      try { decoded = msg.content(); preview = previewOfXmtpContent(decoded, msg.contentTypeId); }
      catch { preview = `[${msg.contentTypeId ?? 'unknown'}]`; }
      if (typeof decoded === 'string' && isMetroControlBody(decoded)) return;
      const lastTs = msg.sentNs ? Math.floor(msg.sentNs / 1_000_000) : Date.now();
      const lastPreview = preview.slice(0, 80);

      const msgConvId = streamConvId
        ?? convIdFromTopic((msg as unknown as { topic?: string }).topic)
        ?? (msg as unknown as { conversationId?: string }).conversationId
        ?? null;

      const result = applyToRows(msgConvId, msg, lastTs, lastPreview, setRows);
      if (result.needsRefresh) onMiss(msgConvId);
      maybeNotify(result.notify, msgConvId, msg.id, lastPreview);
    }))();
  };
}

function updatedRow(cur: RowT, msg: StreamedMsg, lastTs: number, lastPreview: string, senderAddr: string | null): RowT {
  const newAvatar = cur.peerAddress ?? cur.avatarAddress;
  const lastFromSelf = msg.senderInboxId === cur.selfInboxId;
  const isUnread = (msg.sentNs ?? 0) > cur.lastReadNs && msg.senderInboxId !== cur.selfInboxId;
  const unreadCount = isUnread ? cur.unreadCount + 1 : cur.unreadCount;
  const updated: RowT = {
    ...cur, lastTs, lastPreview, avatarAddress: newAvatar,
    lastSenderAddress: senderAddr, lastFromSelf, unreadCount,
  };
  if (isUnread) updated.markedUnread = false;
  return updated;
}

function applyToRows(
  msgConvId: string | null, msg: StreamedMsg, lastTs: number, lastPreview: string,
  setRows: MsgHandlerDeps['setRows'],
): { needsRefresh: boolean; notify: NotifyCtx | null } {
  let needsRefresh = false;
  let notify: NotifyCtx | null = null;
  setRows(prev => {
    if (!prev) return prev;
    const idx = msgConvId ? prev.findIndex(r => r.convId === msgConvId) : -1;
    const cur = idx === -1 ? undefined : prev[idx];
    if (cur === undefined) { needsRefresh = true; return prev; }
    const senderAddr = cur.inboxToAddr[msg.senderInboxId ?? ''] ?? null;
    notify = {
      title: cur.title, senderAddr,
      isGroup: cur.peerAddress == null, fromSelf: msg.senderInboxId === cur.selfInboxId,
    };
    const updated = updatedRow(cur, msg, lastTs, lastPreview, senderAddr);
    return [updated, ...prev.slice(0, idx), ...prev.slice(idx + 1)];
  });
  return { needsRefresh, notify };
}

function notifyTitleBody(n: NotifyCtx, preview: string): { title: string; body: string } {
  const senderName = getPeerName(n.senderAddr)
    ?? (n.senderAddr ? shortAddress(n.senderAddr) : 'New message');
  if (n.isGroup) return { title: n.title, body: `${senderName}: ${preview}` };
  return { title: getPeerName(n.senderAddr) ?? n.title, body: preview };
}

function shouldSkipNotify(n: NotifyCtx | null, convId: string | null, msgId: string | undefined): n is null {
  if (!n || n.fromSelf || !convId || isActiveConv(convId)) return true;
  if (msgId && alreadyNotified(msgId)) return true;
  return false;
}

function maybeNotify(
  n: NotifyCtx | null, convId: string | null, msgId: string | undefined, preview: string,
): void {
  if (shouldSkipNotify(n, convId, msgId) || !n || !convId) return;
  const { title, body } = notifyTitleBody(n, preview);
  void presentInboundNotification({ title, body, convId, messageId: msgId });
}
