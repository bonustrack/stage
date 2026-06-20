
import type { Conversation, DecodedMessage } from '@xmtp/react-native-sdk';
import {
  peerEthAddressOfDm, groupMemberEthAddresses, memberInboxToAddressMap,
  shortAddress, getLastReadNs,
} from '../../lib/xmtp';
import { labelsOfSyncedGroup } from '../../lib/xmtp.labels';
import { githubOfSyncedGroup } from '../../lib/xmtp.github';
import { isMetroControlBody } from '../../lib/push';
import { previewOfXmtpContent } from '@stage-labs/client/xmtp/humanize';
import { channelStampSeed } from '@stage-labs/kit/avatar';
import type {
  ConversationView, ConversationRequestView, RequestAvatarDescriptor,
} from './conversation.types';

export type {
  ConversationView, ConversationRequestView, RequestAvatarDescriptor,
} from './conversation.types';

function pickLastMessage(msgs: DecodedMessage[]): DecodedMessage | undefined {
  return msgs.find(m => {
    try { const c: unknown = m.content(); return !(typeof c === 'string' && isMetroControlBody(c)); }
    catch { return true; }
  }) ?? msgs[0];
}

function previewOfMessage(last: DecodedMessage | undefined): string {
  if (!last) return '';
  try { return previewOfXmtpContent(last.content(), last.contentTypeId); }
  catch { return `[${last.contentTypeId ?? 'unknown'}]`; }
}

async function readGroupNameImage(
  conv: Conversation,
): Promise<{ name: string; imageUrl: string }> {
  const g = conv as unknown as { name?: () => Promise<string>; imageUrl?: () => Promise<string> };
  const [n, img] = await Promise.all([
    g.name?.() ?? Promise.resolve(''),
    g.imageUrl?.().catch(() => '') ?? Promise.resolve(''),
  ]);
  return { name: n ?? '', imageUrl: img ?? '' };
}

function computeTitle(
  conv: Conversation, peerAddress: string | null, groupName: string,
  memberAddresses: string[], totalMembers: number,
): string {
  if (peerAddress) return shortAddress(peerAddress);
  if (groupName.trim()) return groupName.trim();
  if (memberAddresses.length > 0) return `${totalMembers} member${totalMembers === 1 ? '' : 's'}`;
  return conv.topic.replace(/^.*\//, '').slice(0, 12);
}

function countUnread(msgs: DecodedMessage[], lastReadNs: number, selfInboxId: string): number {
  let unreadCount = 0;
  for (const m of msgs) {
    if (!m.sentNs || m.sentNs <= lastReadNs) break;
    if (m.senderInboxId === selfInboxId) continue;
    unreadCount += 1;
  }
  return unreadCount;
}

interface GroupRowData {
  memberAddresses: string[];
  groupMeta: { name: string; imageUrl: string };
  labels: Awaited<ReturnType<typeof labelsOfSyncedGroup>>;
  github: Awaited<ReturnType<typeof githubOfSyncedGroup>> | undefined;
}

async function gatherGroupRowData(conv: Conversation, peerAddress: string | null): Promise<GroupRowData> {
  if (peerAddress) {
    return { memberAddresses: [], groupMeta: { name: '', imageUrl: '' }, labels: [], github: undefined };
  }
  const [memberAddresses, groupMeta, labels, github] = await Promise.all([
    groupMemberEthAddresses(conv),
    readGroupNameImage(conv),
    labelsOfSyncedGroup(conv),
    githubOfSyncedGroup(conv),
  ]);
  return { memberAddresses, groupMeta, labels, github };
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
  const msgs: DecodedMessage[] = await conv.messages({ limit: 2 }).catch(() => []);
  const last = pickLastMessage(msgs);
  const preview = previewOfMessage(last);
  const peerAddress = await peerEthAddressOfDm(conv);
  const inboxToAddr = await memberInboxToAddressMap(conv);
  const { memberAddresses, groupMeta, labels, github } = await gatherGroupRowData(conv, peerAddress);
  const totalMembers = memberAddresses.length + 1;
  const title = computeTitle(conv, peerAddress, groupMeta.name, memberAddresses, totalMembers);
  const lastSenderAddress = last?.senderInboxId
    ? inboxToAddr[last.senderInboxId] ?? null
    : null;
  const lastFromSelf = !!last && last.senderInboxId === selfInboxId;
  const { avatarUri, avatarAddress } = rowAvatar(conv, peerAddress, groupMeta.imageUrl);
  const lastReadNs = await getLastReadNs(conv.id);
  const unreadCount = countUnread(msgs, lastReadNs, selfInboxId);
  const markedUnread = lastReadNs === 0
    && unreadCount === 0 && !!last && !lastFromSelf;
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
    github,
  };
}

async function readRequestGroupData(
  conv: Conversation, isGroup: boolean,
): Promise<{ memberAddresses: string[]; groupName: string; groupImage: string }> {
  if (!isGroup) return { memberAddresses: [], groupName: '', groupImage: '' };
  const g = conv as unknown as { name?: () => Promise<string>; imageUrl?: () => Promise<string> };
  const [memberAddresses, groupName, groupImageRaw] = await Promise.all([
    groupMemberEthAddresses(conv),
    g.name?.().catch(() => '') ?? Promise.resolve(''),
    g.imageUrl?.().catch(() => '') ?? Promise.resolve(''),
  ]);
  return { memberAddresses, groupName: groupName ?? '', groupImage: (groupImageRaw ?? '').trim() };
}

export async function summarizeConversationRequest(
  conv: Conversation,
): Promise<ConversationRequestView> {
  await conv.sync().catch(() => undefined);
  const peerAddress = await peerEthAddressOfDm(conv);
  const isGroup = !peerAddress;
  const { memberAddresses, groupName, groupImage } = await readRequestGroupData(conv, isGroup);
  const recent: DecodedMessage[] = await conv.messages({ limit: 1 }).catch(() => []);
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
  const g = conv as unknown as { imageUrl?: () => Promise<string> };
  const imageUrl = (await g.imageUrl?.().catch(() => '') ?? '').trim();
  return {
    convId: conv.id,
    avatarAddress: imageUrl ? null : channelStampSeed(conv.id),
    avatarUri: imageUrl || null,
    isGroup: true,
  };
}
