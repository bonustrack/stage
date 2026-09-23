
import type { Conversation } from '@xmtp/react-native-sdk';
import { peerEthAddressOfDm, groupMemberEthAddresses, memberInboxToAddressMap } from '../../lib/xmtp.identity';
import { getLastReadNs, getMarkedUnread } from '../../lib/xmtp.client';
import { groupNameImage } from '../../lib/xmtp.groups';
import { rowMessagesOf } from '../../lib/xmtp.messages';
import { groupLabelsOf } from '../../lib/xmtp.labels';
import { isControlBody } from '../../lib/xmtp.types';
import { isGroupUpdateTypeId, previewOfXmtpContent } from '@stage-labs/client/xmtp/humanize';
import { revivesClearedChat } from '@stage-labs/client/xmtp/readState';
import { channelStampSeed } from '@stage-labs/kit/avatar';
import {
  channelRowTitle, countUnreadEntries, initialMarkedUnread,
  ROW_PREVIEW_MAX_CHARS, type RowMessage,
} from '@stage-labs/client/xmtp/summarizeRow';
import { reported, recover } from '../../lib/errorPolicy';
export interface ConversationView {
  convId: string;
  title: string;
  lastTs: number | null;
  lastBubbleTs: number | null;
  lastPreview: string;
  avatarAddress: string | null;
  avatarUri: string | null;
  peerAddress: string | null;
  lastSenderAddress: string | null;
  lastFromSelf: boolean;
  inboxToAddr: Record<string, string>;
  unreadCount: number;
  lastReadNs: number;
  markedUnread: boolean;
  selfInboxId: string;
  labels: string[];
}

function isMembershipNoise(m: RowMessage, dm: boolean): boolean {
  return dm && isGroupUpdateTypeId(m.contentTypeId);
}

function pickLastMessage(msgs: RowMessage[], dm: boolean): RowMessage | undefined {
  return msgs.find(m =>
    !(typeof m.content === 'string' && isControlBody(m.content)) && !isMembershipNoise(m, dm),
  ) ?? msgs[0];
}

function lastBubbleTsOf(msgs: RowMessage[], dm: boolean): number | null {
  const bubble = msgs.find(m =>
    !(typeof m.content === 'string' && isControlBody(m.content)) && !isMembershipNoise(m, dm)
    && revivesClearedChat(m.contentTypeId),
  );
  return bubble?.sentNs ? Math.floor(bubble.sentNs / 1_000_000) : null;
}

function previewOfMessage(last: RowMessage | undefined, dm: boolean): string {
  if (!last || isMembershipNoise(last, dm)) return '';
  try { return previewOfXmtpContent(last.content, last.contentTypeId); }
  catch { return `[${last.contentTypeId ?? 'unknown'}]`; }
}

interface GroupRowData {
  memberAddresses: string[];
  groupMeta: { name: string; imageUrl: string };
  labels: Awaited<ReturnType<typeof groupLabelsOf>>;
}

async function gatherGroupRowData(conv: Conversation, peerAddress: string | null): Promise<GroupRowData> {
  if (peerAddress) {
    return { memberAddresses: [], groupMeta: { name: '', imageUrl: '' }, labels: [] };
  }
  const [memberAddresses, groupMeta, labels] = await Promise.all([
    groupMemberEthAddresses(conv),
    groupNameImage(conv),
    groupLabelsOf(conv),
  ]);
  return { memberAddresses, groupMeta, labels };
}

function rowAvatar(
  conv: Conversation, peerAddress: string | null, groupImageUrl: string,
): { avatarUri: string | null; avatarAddress: string | null } {
  const avatarUri = peerAddress ? null : (groupImageUrl.trim() || null);
  const avatarAddress = peerAddress ?? (avatarUri ? null : channelStampSeed(conv.id));
  return { avatarUri, avatarAddress };
}

function lastSenderAddressOf(last: RowMessage | undefined, inboxToAddr: Record<string, string>): string | null {
  return last?.senderInboxId ? inboxToAddr[last.senderInboxId] ?? null : null;
}

async function resolveMarkedUnread(
  convId: string, inputs: Parameters<typeof initialMarkedUnread>[0],
): Promise<boolean> {
  if (await getMarkedUnread(convId)) return true;
  return initialMarkedUnread(inputs);
}

export async function summarizeConversation(
  conv: Conversation, selfInboxId: string, alreadySynced = false,
): Promise<ConversationView> {
  if (!alreadySynced) await conv.sync().catch(reported('conversation.sync'));
  const peerAddress = await peerEthAddressOfDm(conv);
  const dm = peerAddress !== null;
  const msgs = await rowMessagesOf(conv, dm ? 6 : 2).catch(recover('conversation.rowMessages', []));
  const last = pickLastMessage(msgs, dm);
  const preview = previewOfMessage(last, dm);
  const inboxToAddr = await memberInboxToAddressMap(conv);
  const { memberAddresses, groupMeta, labels } = await gatherGroupRowData(conv, peerAddress);
  const topic: string | undefined = conv.topic;
  const title = channelRowTitle({
    peerAddress, groupName: groupMeta.name,
    memberCount: memberAddresses.length,
    fallbackId: (topic ?? conv.id).replace(/^.*\//, ''),
  });
  const lastSenderAddress = lastSenderAddressOf(last, inboxToAddr);
  const lastFromSelf = !!last && last.senderInboxId === selfInboxId;
  const { avatarUri, avatarAddress } = rowAvatar(conv, peerAddress, groupMeta.imageUrl);
  const lastReadNs = await getLastReadNs(conv.id);
  const unreadCount = countUnreadEntries(msgs, lastReadNs, selfInboxId);
  const markedUnread = await resolveMarkedUnread(conv.id, {
    lastReadNs, unreadCount, hasLast: !!last, lastFromSelf,
  });
  return {
    convId: conv.id,
    title,
    lastTs: last?.sentNs ? Math.floor(last.sentNs / 1_000_000) : null,
    lastBubbleTs: lastBubbleTsOf(msgs, dm),
    lastPreview: preview.slice(0, ROW_PREVIEW_MAX_CHARS),
    avatarAddress,
    avatarUri,
    peerAddress,
    lastSenderAddress,
    lastFromSelf,
    inboxToAddr,
    unreadCount,
    lastReadNs,
    selfInboxId,
    markedUnread,
    labels,
  };
}
