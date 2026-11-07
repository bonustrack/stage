import { shortAddress } from '@stage-labs/client/identity/format';
import { rowPreviewOf } from '@stage-labs/client/xmtp/contentTypes';
import { applyInbound } from '@stage-labs/client/xmtp/channelsCache';
import { ROW_PREVIEW_MAX_CHARS, type StreamedMessage } from '@stage-labs/client/xmtp/summarizeRow';
import { arrivalEffect, countsAsUnread, isRowCandidate, revivesRow } from '@stage-labs/client/xmtp/visibility';
import { getCachedRows, setCachedRows } from '../channelsCache';
import { recover } from '../errorPolicy';
import { getPeerName } from '../peerProfiles';
import { presentInboundNotification } from '../pushNotify';
import { isChannelHidden } from '../sync/hiddenChannels';
import { getConvConsentState } from '../xmtp.conv';
import { isActiveConv } from '../xmtp.state.core';

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
  let missTimer: ReturnType<typeof setTimeout> | null = null;
  let refreshInFlight = false;

  const runRefresh = (): void => {
    if (refreshInFlight) {
      armFullRefresh();
      return;
    }
    refreshInFlight = true;
    void refresh().finally(() => {
      refreshInFlight = false;
    });
  };
  function armFullRefresh(): void {
    if (missTimer) clearTimeout(missTimer);
    missTimer = setTimeout(() => {
      missTimer = null;
      if (!isCancelled()) runRefresh();
    }, 1_000);
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
    if (isCancelled() || !msg || isChannelHidden(streamConvId)) return;
    const effect = arrivalEffect(msg);
    if (effect === 'refresh') onMiss(streamConvId);
    if (effect !== 'row') return;
    const lastTs = msg.sentNs ? Math.floor(msg.sentNs / 1_000_000) : Date.now();
    const lastPreview = rowPreviewOf(msg).slice(0, ROW_PREVIEW_MAX_CHARS);

    const result = applyToRows(streamConvId, msg, lastTs, lastPreview);
    if (result.needsRefresh) onMiss(streamConvId);
    maybeNotify(result.notify, streamConvId, msg.id, lastPreview);
  };
}

function applyToRows(
  msgConvId: string | null,
  msg: StreamedMessage,
  lastTs: number,
  lastPreview: string,
): { needsRefresh: boolean; notify: NotifyCtx | null } {
  const unchanged = { needsRefresh: false, notify: null };
  const prev = getCachedRows();
  if (!prev) return unchanged;
  const target = prev.find((r) => r.convId === msgConvId);
  const dm = target?.peerAddress != null;
  if (target !== undefined && !isRowCandidate(msg, dm)) return unchanged;
  const result = applyInbound(
    prev,
    {
      convId: msgConvId,
      senderInboxId: msg.senderInboxId,
      sentNs: msg.sentNs,
      lastTs,
      lastPreview,
      countsAsUnread: countsAsUnread(msg) && !alreadyCounted(msg.id),
    },
    (cur) => ({
      avatarAddress: cur.peerAddress ?? cur.avatarAddress,
      lastSenderAddress: cur.inboxToAddr[msg.senderInboxId] ?? null,
      lastFromSelf: msg.senderInboxId === cur.selfInboxId,
      lastBubbleTs: revivesRow(msg, dm) ? lastTs : cur.lastBubbleTs,
    }),
  );
  if (result === null) return { needsRefresh: true, notify: null };
  setCachedRows(result.next);
  const { current } = result;
  return {
    needsRefresh: false,
    notify: {
      title: current.title,
      senderAddr: current.inboxToAddr[msg.senderInboxId] ?? null,
      isGroup: current.peerAddress == null,
      fromSelf: msg.senderInboxId === current.selfInboxId,
    },
  };
}

function notifyTitleBody(n: NotifyCtx, preview: string): { title: string; body: string } {
  const senderName = getPeerName(n.senderAddr) ?? (n.senderAddr ? shortAddress(n.senderAddr) : 'New message');
  if (n.isGroup) return { title: n.title, body: `${senderName}: ${preview}` };
  return { title: getPeerName(n.senderAddr) ?? n.title, body: preview };
}

function maybeNotify(n: NotifyCtx | null, convId: string | null, msgId: string | undefined, preview: string): void {
  if (!n || n.fromSelf || !convId || isActiveConv(convId)) return;
  if (msgId && alreadyNotified(msgId)) return;
  const { title, body } = notifyTitleBody(n, preview);
  void presentInboundNotification({ title, body, convId, messageId: msgId });
}
