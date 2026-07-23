
import type { Conversation } from '@xmtp/react-native-sdk';
import {
  peerEthAddressOfDm, groupMemberEthAddresses, memberInboxToAddressMap,
  shortAddress, getLastReadNs,
} from '../../lib/xmtp';
import { groupNameImage } from '../../lib/xmtp.groups';
import { rowMessagesOf } from '../../lib/xmtp.messages';
import { labelsOfSyncedGroup } from '../../lib/xmtp.labels';
import { isMetroControlBody } from '../../lib/push';
import { previewOfXmtpContent } from '@stage-labs/client/xmtp/humanize';
import { channelStampSeed } from '@stage-labs/kit/avatar';
import {
  channelRowTitle, countUnreadEntries, initialMarkedUnread, type RowMessage,
} from '@stage-labs/client/xmtp/summarizeRow';
import type {
  ConversationView, ConversationRequestView, RequestAvatarDescriptor,
} from './conversation.types';

export type {
  ConversationView, ConversationRequestView, RequestAvatarDescriptor,
} from './conversation.types';

function pickLastMessage(msgs: RowMessage[]): RowMessage | undefined {
  return msgs.find(m =>
    !(typeof m.content === 'string' && isMetroControlBody(m.content)),
  ) ?? msgs[0];
}

function previewOfMessage(last: RowMessage | undefined): string {
  if (!last) return '';
  try { return previewOfXmtpContent(last.content, last.contentTypeId); }
  catch { return `[${last.contentTypeId ?? 'unknown'}]`; }
}

interface GroupRowData {
  memberAddresses: string[];
  groupMeta: { name: string; imageUrl: string };
  labels: Awaited<ReturnType<typeof labelsOfSyncedGroup>>;
}

async function gatherGroupRowData(conv: Conversation, peerAddress: string | null): Promise<GroupRowData> {
  if (peerAddress) {
    return { memberAddresses: [], groupMeta: { name: '', imageUrl: '' }, labels: [] };
  }
  const [memberAddresses, groupMeta, labels] = await Promise.all([
    groupMemberEthAddresses(conv),
    groupNameImage(conv),
    labelsOfSyncedGroup(conv),
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

export async function summarizeConversation(
  conv: Conversation, selfInboxId: string,
): Promise<ConversationView> {
  await conv.sync().catch(() => undefined);
  const msgs = await rowMessagesOf(conv, 2).catch(() => []);
  const last = pickLastMessage(msgs);
  const preview = previewOfMessage(last);
  const peerAddress = await peerEthAddressOfDm(conv);
  const inboxToAddr = await memberInboxToAddressMap(conv);
  const { memberAddresses, groupMeta, labels } = await gatherGroupRowData(conv, peerAddress);
  const topic: string | undefined = conv.topic;
  const title = channelRowTitle({
    peerAddress, groupName: groupMeta.name,
    memberCount: memberAddresses.length,
    fallbackId: (topic ?? conv.id).replace(/^.*\//, ''),
  });
  const lastSenderAddress = last?.senderInboxId
    ? inboxToAddr[last.senderInboxId] ?? null
    : null;
  const lastFromSelf = !!last && last.senderInboxId === selfInboxId;
  const { avatarUri, avatarAddress } = rowAvatar(conv, peerAddress, groupMeta.imageUrl);
  const lastReadNs = await getLastReadNs(conv.id);
  const unreadCount = countUnreadEntries(msgs, lastReadNs, selfInboxId);
  const markedUnread = initialMarkedUnread({
    lastReadNs, unreadCount, hasLast: !!last, lastFromSelf,
  });
  return {
    convId: conv.id,
    title,
    lastTs: last?.sentNs ? Math.floor(last.sentNs / 1_000_000) : null,
    lastPreview: preview.slice(0, 80),
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

async function readRequestGroupData(
  conv: Conversation, isGroup: boolean,
): Promise<{ memberAddresses: string[]; groupName: string; groupImage: string }> {
  if (!isGroup) return { memberAddresses: [], groupName: '', groupImage: '' };
  const [memberAddresses, groupMeta] = await Promise.all([
    groupMemberEthAddresses(conv),
    groupNameImage(conv),
  ]);
  return { memberAddresses, groupName: groupMeta.name, groupImage: groupMeta.imageUrl.trim() };
}

export async function summarizeConversationRequest(
  conv: Conversation,
): Promise<ConversationRequestView> {
  await conv.sync().catch(() => undefined);
  const peerAddress = await peerEthAddressOfDm(conv);
  const isGroup = !peerAddress;
  const { memberAddresses, groupName, groupImage } = await readRequestGroupData(conv, isGroup);
  const recent = await rowMessagesOf(conv, 1).catch(() => []);
  const last = recent[0];
  const preview = previewOfMessage(last);
  const title = peerAddress
    ? shortAddress(peerAddress)
    : (groupName.trim() || `${memberAddresses.length + 1} members`);
  const avatarUri = isGroup ? (groupImage || null) : null;
  const avatarAddress = peerAddress ?? (avatarUri ? null : channelStampSeed(conv.id));
  return {
    convId: conv.id,
    title,
    peerAddress,
    avatarAddress,
    avatarUri,
    preview: preview.slice(0, 80),
    isGroup,
  };
}

export async function requestAvatarDescriptor(
  conv: Conversation,
): Promise<RequestAvatarDescriptor> {
  const peerAddress = await peerEthAddressOfDm(conv).catch(() => null);
  if (peerAddress) {
    return { convId: conv.id, avatarAddress: peerAddress, avatarUri: null, isGroup: false };
  }
  const imageUrl = (await groupNameImage(conv).catch(() => ({ name: '', imageUrl: '' }))).imageUrl.trim();
  return {
    convId: conv.id,
    avatarAddress: imageUrl ? null : channelStampSeed(conv.id),
    avatarUri: imageUrl || null,
    isGroup: true,
  };
}
