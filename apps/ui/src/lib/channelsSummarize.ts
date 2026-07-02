
import type { Conversation } from '@xmtp/browser-sdk';
import {
  peerEthAddressOfDm, groupMemberEthAddresses, memberInboxToAddressMap,
  getLastReadNs, getConvConsent,
} from './xmtp';
import { previewOfXmtpContent } from '@stage-labs/client/xmtp/humanize';
import { labelsOfSyncedGroup } from '@stage-labs/client/xmtp/labels';
import { channelRowTitle, countUnreadEntries, initialMarkedUnread } from '@stage-labs/client/xmtp/summarizeRow';

export interface ChannelRow {
  convId: string;
  title: string;
  lastTs: number | null;
  lastPreview: string;
  avatarAddress: string | null;
  avatarUri: string | null;
  inboxToAddr: Record<string, string>;
  unreadCount: number;
  lastReadNs: number;
  markedUnread: boolean;
  selfInboxId: string;
  peerAddress: string | null;
  memberAddresses: string[];
  labels: string[];
  [key: string]: unknown;
}

interface RecentMsg { content: unknown; contentType?: { typeId?: string }; senderInboxId?: string; sentAtNs: bigint }

function resolveAvatarAddress(
  peerAddress: string | null, lastSenderAddress: string | null, memberAddresses: string[],
): string | null {
  return peerAddress ?? lastSenderAddress ?? memberAddresses[0] ?? null;
}

function senderAddressOf(last: RecentMsg | undefined, inboxToAddr: Record<string, string>): string | null {
  if (!last?.senderInboxId) return null;
  return inboxToAddr[last.senderInboxId] ?? null;
}

function resolveAvatarUri(peerAddress: string | null, imageUrl: string | undefined): string | null {
  if (peerAddress) return null;
  return (imageUrl ?? '').trim() || null;
}

async function resolveMarkedUnread(
  convId: string, lastReadNs: number, unreadCount: number, hasLast: boolean, lastFromSelf: boolean,
): Promise<boolean> {
  const consent = await getConvConsent(convId).catch(() => 'unknown' as const);
  return initialMarkedUnread({
    lastReadNs, unreadCount, hasLast, lastFromSelf,
    consentUnknown: consent === 'unknown',
  });
}

export async function summarizeConv(
  conv: Conversation, selfInboxId: string,
): Promise<ChannelRow> {
  const msgs = await conv.messages({ limit: 50n }).catch(() => []);
  const recent = [...msgs].reverse() as RecentMsg[];
  const last = recent[0];
  const preview = last ? previewOfXmtpContent(last.content, last.contentType?.typeId) : '';
  const peerAddress = await peerEthAddressOfDm(conv);
  const memberAddresses = peerAddress ? [] : await groupMemberEthAddresses(conv);
  const labels = peerAddress ? [] : await labelsOfSyncedGroup(conv).catch(() => []);
  const inboxToAddr = await memberInboxToAddressMap(conv);
  const groupMeta = conv as unknown as { name?: string; imageUrl?: string };
  const resolvedName = (groupMeta.name ?? '').trim();
  const title = channelRowTitle({
    peerAddress, groupName: resolvedName,
    memberCount: memberAddresses.length, fallbackId: conv.id,
  });
  const lastSenderAddress = senderAddressOf(last, inboxToAddr);
  const avatarAddress = resolveAvatarAddress(peerAddress, lastSenderAddress, memberAddresses);
  const avatarUri = resolveAvatarUri(peerAddress, groupMeta.imageUrl);
  const lastReadNs = getLastReadNs(conv.id);
  const unreadCount = countUnreadEntries(recent.map(m => ({ sentNs: Number(m.sentAtNs), senderInboxId: m.senderInboxId })), lastReadNs, selfInboxId);
  const lastFromSelf = !!last && last.senderInboxId === selfInboxId;
  const markedUnread = await resolveMarkedUnread(
    conv.id, lastReadNs, unreadCount, !!last, lastFromSelf,
  );
  return {
    convId: conv.id,
    title,
    lastTs: last ? Number(last.sentAtNs / 1_000_000n) : null,
    lastPreview: preview.slice(0, 80),
    avatarAddress,
    avatarUri,
    inboxToAddr,
    unreadCount,
    lastReadNs,
    markedUnread,
    selfInboxId,
    peerAddress,
    memberAddresses,
    labels,
  };
}
