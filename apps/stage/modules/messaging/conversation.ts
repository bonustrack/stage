
import type { Conversation } from '@xmtp/react-native-sdk';
import {
  peerEthAddressOfDm, groupMemberEthAddresses, memberInboxToAddressMap,
  getLastReadNs, getMarkedUnread,
} from '../../lib/xmtp';
import { groupNameImage } from '../../lib/xmtp.groups';
import { rowMessagesOf } from '../../lib/xmtp.messages';
import { labelsOfSyncedGroup } from '../../lib/xmtp.labels';
import { isControlBody } from '../../lib/xmtp.types';
import { previewOfXmtpContent } from '@stage-labs/client/xmtp/humanize';
import { channelStampSeed } from '@stage-labs/kit/avatar';
import {
  channelRowTitle, countUnreadEntries, initialMarkedUnread,
  ROW_PREVIEW_MAX_CHARS, type RowMessage,
} from '@stage-labs/client/xmtp/summarizeRow';
export interface ConversationView {
  convId: string;
  title: string;
  lastTs: number | null;
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

function pickLastMessage(msgs: RowMessage[]): RowMessage | undefined {
  return msgs.find(m =>
    !(typeof m.content === 'string' && isControlBody(m.content)),
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

async function resolveMarkedUnread(
  convId: string, inputs: Parameters<typeof initialMarkedUnread>[0],
): Promise<boolean> {
  if (await getMarkedUnread(convId)) return true;
  return initialMarkedUnread(inputs);
}

export async function summarizeConversation(
  conv: Conversation, selfInboxId: string, alreadySynced = false,
): Promise<ConversationView> {
  if (!alreadySynced) await conv.sync().catch(() => undefined);
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
  const markedUnread = await resolveMarkedUnread(conv.id, {
    lastReadNs, unreadCount, hasLast: !!last, lastFromSelf,
  });
  return {
    convId: conv.id,
    title,
    lastTs: last?.sentNs ? Math.floor(last.sentNs / 1_000_000) : null,
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
