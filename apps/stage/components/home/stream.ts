
import { presentInboundNotification } from '../../lib/pushNotify';
import { isGroupUpdateTypeId, previewOfXmtpContent } from '@stage-labs/client/xmtp/humanize';
import { getPeerName } from '../../lib/peerProfiles';
import { isActiveConv } from '../../lib/readSyncRegistry';
import { isControlBody, shortAddress, getConvConsentState, setCachedRows } from '../../modules/messaging';
import { homeRows } from './state';
import { applyInbound } from '@stage-labs/client/xmtp/channelsCache';
import { ROW_PREVIEW_MAX_CHARS, type StreamedMessage } from '@stage-labs/client/xmtp/summarizeRow';
import { revivesClearedChat } from '@stage-labs/client/xmtp/readState';
import { recover } from '../../lib/errorPolicy';

function makeSeenOnce(limit: number): (id: string) => boolean {
  const seen = new Set<string>();
  return (id) => {
    if (seen.has(id)) return true;
    seen.add(id);
    if (seen.size > limit) {
      const oldest = seen.values().next().value;
      if (oldest !== undefined) seen.delete(oldest);
    }
    return false;
  };
}

const alreadyNotified = makeSeenOnce(200);
const alreadyCounted = makeSeenOnce(2000);

interface NotifyCtx {
  title: string;
  senderAddr: string | null;
  isGroup: boolean;
  fromSelf: boolean;
}

interface MsgHandlerDeps {
  isCancelled: () => boolean;
  refresh: () => Promise<void>;
}

function makeMissRefresher(isCancelled: () => boolean, refresh: () => Promise<void>) {
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
      if (convId && (await getConvConsentState(convId).catch(recover('home.streamConsent', null))) === 'denied') return;
      if (!isCancelled()) armFullRefresh();
    })();
  };
}

export function makeMsgStreamHandler({ isCancelled, refresh }: MsgHandlerDeps) {
  const onMiss = makeMissRefresher(isCancelled, refresh);
  return ({ convId: streamConvId, msg }: { convId: string | null; msg: StreamedMessage | null }): void => {
    if (isCancelled() || !msg) return;
    const decoded = msg.content;
    let preview = '';
    try { preview = previewOfXmtpContent(decoded, msg.contentTypeId); }
    catch { preview = `[${msg.contentTypeId ?? 'unknown'}]`; }
    if (typeof decoded === 'string' && isControlBody(decoded)) return;
    const lastTs = msg.sentNs ? Math.floor(msg.sentNs / 1_000_000) : Date.now();
    const lastPreview = preview.slice(0, ROW_PREVIEW_MAX_CHARS);

    const result = applyToRows(streamConvId, msg, lastTs, lastPreview);
    if (result.needsRefresh) onMiss(streamConvId);
    maybeNotify(result.notify, streamConvId, msg.id, lastPreview);
  };
}

function applyToRows(
  msgConvId: string | null, msg: StreamedMessage, lastTs: number, lastPreview: string,
): { needsRefresh: boolean; notify: NotifyCtx | null } {
  const unchanged = { needsRefresh: false, notify: null };
  const prev = homeRows();
  if (!prev) return unchanged;
  const target = prev.find(r => r.convId === msgConvId);
  if (target?.peerAddress != null && isGroupUpdateTypeId(msg.contentTypeId)) return unchanged;
  const result = applyInbound(
    prev,
    {
      convId: msgConvId, senderInboxId: msg.senderInboxId, sentNs: msg.sentNs, lastTs, lastPreview,
      countsAsUnread: !isGroupUpdateTypeId(msg.contentTypeId) && !alreadyCounted(msg.id),
    },
    cur => ({
      avatarAddress: cur.peerAddress ?? cur.avatarAddress,
      lastSenderAddress: cur.inboxToAddr[msg.senderInboxId] ?? null,
      lastFromSelf: msg.senderInboxId === cur.selfInboxId,
      lastBubbleTs: revivesClearedChat(msg.contentTypeId) ? lastTs : cur.lastBubbleTs,
    }),
  );
  if (result === null) return { needsRefresh: true, notify: null };
  setCachedRows(result.next);
  const { current } = result;
  return {
    needsRefresh: false,
    notify: {
      title: current.title, senderAddr: current.inboxToAddr[msg.senderInboxId] ?? null,
      isGroup: current.peerAddress == null, fromSelf: msg.senderInboxId === current.selfInboxId,
    },
  };
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
