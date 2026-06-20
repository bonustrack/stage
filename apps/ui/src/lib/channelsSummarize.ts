
import type { Conversation } from '@xmtp/browser-sdk';
import {
  peerEthAddressOfDm, groupMemberEthAddresses, memberInboxToAddressMap,
  getLastReadNs, getConvConsent, shortAddress,
} from './xmtp';
import { previewOfXmtpContent } from '@stage-labs/client/xmtp/humanize';

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
  [key: string]: unknown;
}

interface RecentMsg { content: unknown; contentType?: { typeId?: string }; senderInboxId?: string; sentAtNs: bigint }

function resolveTitle(
  peerAddress: string | null, resolvedName: string, memberAddresses: string[], convId: string,
): string {
  if (peerAddress) return shortAddress(peerAddress);
  if (resolvedName) return resolvedName;
  if (memberAddresses.length > 0) {
    const totalMembers = memberAddresses.length + 1;
    return `${totalMembers} member${totalMembers === 1 ? '' : 's'}`;
  }
  return convId.slice(0, 12);
}

function countUnread(recent: RecentMsg[], lastReadNs: number, selfInboxId: string): number {
  let unreadCount = 0;
  for (const m of recent) {
    const sentNs = Number(m.sentAtNs);
    if (!sentNs || sentNs <= lastReadNs) break;
    if (m.senderInboxId === selfInboxId) continue;
    unreadCount += 1;
  }
  return unreadCount;
}

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
  return consent === 'unknown' && lastReadNs === 0 && unreadCount === 0 && hasLast && !lastFromSelf;
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
  const inboxToAddr = await memberInboxToAddressMap(conv);
  const groupMeta = conv as unknown as { name?: string; imageUrl?: string };
  const resolvedName = (groupMeta.name ?? '').trim();
  const title = resolveTitle(peerAddress, resolvedName, memberAddresses, conv.id);
  const lastSenderAddress = senderAddressOf(last, inboxToAddr);
  const avatarAddress = resolveAvatarAddress(peerAddress, lastSenderAddress, memberAddresses);
  const avatarUri = resolveAvatarUri(peerAddress, groupMeta.imageUrl);
  const lastReadNs = getLastReadNs(conv.id);
  const unreadCount = countUnread(recent, lastReadNs, selfInboxId);
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
  };
}
