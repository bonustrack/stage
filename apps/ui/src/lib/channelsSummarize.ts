/** @file Pure summariser turning an XMTP conversation into a channels-list row (preview, timestamp, unread, members), pulled out of pages/Channels.vue so it stays under the per-file cap and is unit-testable in isolation. */

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
  /** Stamp.fyi address — used when there's no uploaded group image. */
  avatarAddress: string | null;
  /** Group-uploaded image (ipfs:// or http). Takes precedence over the stamp address when present. Null for DMs. */
  avatarUri: string | null;
  inboxToAddr: Record<string, string>;
  unreadCount: number;
  lastReadNs: number;
  /** Synced cross-device "marked unread" flag from XMTP consent state. */
  markedUnread: boolean;
  selfInboxId: string;
  peerAddress: string | null;
  memberAddresses: string[];
  [key: string]: unknown;
}

/** A decoded XMTP message as exposed by the browser SDK's `messages()` call. */
interface RecentMsg { content: unknown; contentType?: { typeId?: string }; senderInboxId?: string; sentAtNs: bigint }

/** Resolve a conversation's display title from peer address, group name, member count, or id. */
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

/** Count consecutive inbound messages newer than the last-read marker. */
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

/** Pick the stamp avatar address: DM peer, else last sender, else first member. */
function resolveAvatarAddress(
  peerAddress: string | null, lastSenderAddress: string | null, memberAddresses: string[],
): string | null {
  return peerAddress ?? lastSenderAddress ?? memberAddresses[0] ?? null;
}

/** Resolve the eth address of a message's sender via the inbox→address map. */
function senderAddressOf(last: RecentMsg | undefined, inboxToAddr: Record<string, string>): string | null {
  if (!last?.senderInboxId) return null;
  return inboxToAddr[last.senderInboxId] ?? null;
}

/** Resolve a group's uploaded avatar URI (DMs have none). */
function resolveAvatarUri(peerAddress: string | null, imageUrl: string | undefined): string | null {
  if (peerAddress) return null;
  return (imageUrl ?? '').trim() || null;
}

/** Cross-device read flag: consent 'unknown' forces a badge only when this device has no local read marker yet, unread is 0, and the last message is inbound; opening a conv flips consent to 'allowed' so it self-heals and avoids phantom badges on pre-feature conversations. */
async function resolveMarkedUnread(
  convId: string, lastReadNs: number, unreadCount: number, hasLast: boolean, lastFromSelf: boolean,
): Promise<boolean> {
  const consent = await getConvConsent(convId).catch(() => 'unknown' as const);
  return consent === 'unknown' && lastReadNs === 0 && unreadCount === 0 && hasLast && !lastFromSelf;
}

/** Summarise a conversation into a channels-list row (preview, timestamp, unread count, members). */
export async function summarizeConv(
  conv: Conversation, selfInboxId: string,
): Promise<ChannelRow> {
  /** Pull the latest 50 messages — enough for an accurate unread count on active convs without ballooning per-row fetch time. */
  const msgs = await conv.messages({ limit: 50n }).catch(() => []);
  /** Browser SDK returns chronological (oldest-first); flip so msgs[0] is the latest, matching the mobile codepath. */
  const recent = [...msgs].reverse() as RecentMsg[];
  const last = recent[0];
  const preview = last ? previewOfXmtpContent(last.content, last.contentType?.typeId) : '';
  const peerAddress = await peerEthAddressOfDm(conv);
  const memberAddresses = peerAddress ? [] : await groupMemberEthAddresses(conv);
  const inboxToAddr = await memberInboxToAddressMap(conv);
  /** Browser SDK exposes name + imageUrl as synchronous getters. */
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
