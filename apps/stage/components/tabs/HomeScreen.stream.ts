
import { isMetroControlBody, presentInboundNotification } from '../../lib/push';
import { previewOfXmtpContent } from '@stage-labs/client/xmtp/humanize';
import { getPeerName } from '../../lib/peerProfiles';
import { isActiveConv } from '../../lib/activeConv';
import { shortAddress, getConvConsentState } from '../../modules/messaging';
import type { Row as RowT } from './HomeScreen.helpers';
import { applyInbound } from '@stage-labs/client/xmtp/channelsCache';
import { ROW_PREVIEW_MAX_CHARS, type StreamedMessage } from '@stage-labs/client/xmtp/summarizeRow';

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
  return ({ convId: streamConvId, msg }: { convId: string | null; msg: StreamedMessage | null }): void => {
    if (isCancelled() || !msg) return;
    (((): void => {
      const decoded = msg.content;
      let preview = '';
      try { preview = previewOfXmtpContent(decoded, msg.contentTypeId); }
      catch { preview = `[${msg.contentTypeId ?? 'unknown'}]`; }
      if (typeof decoded === 'string' && isMetroControlBody(decoded)) return;
      const lastTs = msg.sentNs ? Math.floor(msg.sentNs / 1_000_000) : Date.now();
      const lastPreview = preview.slice(0, ROW_PREVIEW_MAX_CHARS);

      const result = applyToRows(streamConvId, msg, lastTs, lastPreview, setRows);
      if (result.needsRefresh) onMiss(streamConvId);
      maybeNotify(result.notify, streamConvId, msg.id, lastPreview);
    }))();
  };
}

function applyToRows(
  msgConvId: string | null, msg: StreamedMessage, lastTs: number, lastPreview: string,
  setRows: MsgHandlerDeps['setRows'],
): { needsRefresh: boolean; notify: NotifyCtx | null } {
  let needsRefresh = false;
  let notify: NotifyCtx | null = null;
  setRows(prev => {
    if (!prev) return prev;
    const result = applyInbound(
      prev,
      {
        convId: msgConvId,
        senderInboxId: msg.senderInboxId,
        sentNs: msg.sentNs,
        lastTs,
        lastPreview,
      },
      cur => ({
        avatarAddress: cur.peerAddress ?? cur.avatarAddress,
        lastSenderAddress: cur.inboxToAddr[msg.senderInboxId] ?? null,
        lastFromSelf: msg.senderInboxId === cur.selfInboxId,
      }),
    );
    if (result === null) { needsRefresh = true; return prev; }
    const senderAddr = result.current.inboxToAddr[msg.senderInboxId] ?? null;
    notify = {
      title: result.current.title, senderAddr,
      isGroup: result.current.peerAddress == null, fromSelf: msg.senderInboxId === result.current.selfInboxId,
    };
    return result.next;
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
