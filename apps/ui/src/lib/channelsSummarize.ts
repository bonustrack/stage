/** Pure summarisation pipeline for a single XMTP conversation row. Pulled
 *  out of `pages/Channels.vue` so the view-layer file stays under the
 *  per-file cap and the summariser is unit-testable in isolation. */

import type { Conversation } from '@xmtp/browser-sdk';
import {
  peerEthAddressOfDm, groupMemberEthAddresses, memberInboxToAddressMap,
  getLastReadNs, getConvConsent, shortAddress,
} from './xmtp';
import { previewOfXmtpContent } from '@shared/xmtp/humanize';

export interface ChannelRow {
  convId: string;
  title: string;
  lastTs: number | null;
  lastPreview: string;
  /** Stamp.fyi address — used when there's no uploaded group image. */
  avatarAddress: string | null;
  /** Group-uploaded image (ipfs:// or http). Takes precedence over the
   *  stamp address when present. Null for DMs. */
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

export async function summarizeConv(
  conv: Conversation, selfInboxId: string,
): Promise<ChannelRow> {
  /** Pull the latest 50 messages — enough for an accurate unread count on
   *  active convs without ballooning per-row fetch time. */
  const msgs = await conv.messages({ limit: 50n }).catch(() => []);
  /** Browser SDK returns chronological (oldest-first); flip so msgs[0] is
   *  the latest, matching the mobile codepath. */
  const recent = [...msgs].reverse();
  const last = recent[0];
  const preview = last ? previewOfXmtpContent(last.content, last.contentType?.typeId) : '';
  const peerAddress = await peerEthAddressOfDm(conv);
  const memberAddresses = peerAddress ? [] : await groupMemberEthAddresses(conv);
  const inboxToAddr = await memberInboxToAddressMap(conv);
  const totalMembers = memberAddresses.length + 1;
  /** Browser SDK exposes name + imageUrl as synchronous getters. */
  const groupMeta = conv as unknown as { name?: string; imageUrl?: string };
  const resolvedName = (groupMeta.name ?? '').trim();
  const title = peerAddress
    ? shortAddress(peerAddress)
    : (resolvedName
      ? resolvedName
      : memberAddresses.length > 0
        ? `${totalMembers} member${totalMembers === 1 ? '' : 's'}`
        : conv.id.slice(0, 12));
  const lastSenderAddress = last?.senderInboxId
    ? inboxToAddr[last.senderInboxId] ?? null
    : null;
  const avatarAddress = peerAddress ?? lastSenderAddress ?? memberAddresses[0] ?? null;
  const avatarUri = peerAddress ? null : ((groupMeta.imageUrl ?? '').trim() || null);
  const lastReadNs = getLastReadNs(conv.id);
  let unreadCount = 0;
  for (const m of recent) {
    const sentNs = Number(m.sentAtNs);
    if (!sentNs || sentNs <= lastReadNs) break;
    if (m.senderInboxId === selfInboxId) continue;
    unreadCount += 1;
  }
  const lastFromSelf = !!last && last.senderInboxId === selfInboxId;
  /** Cross-device read flag: consent 'unknown' forces a badge only when this
   *  device has no local read marker yet (lastReadNs === 0), the timestamp
   *  count is 0, and there's an inbound last message. Opening a conv flips
   *  consent → 'allowed', so this self-heals and avoids phantom badges on
   *  conversations read before this feature existed. */
  const consent = await getConvConsent(conv.id).catch(() => 'unknown' as const);
  const markedUnread = consent === 'unknown' && lastReadNs === 0
    && unreadCount === 0 && !!last && !lastFromSelf;
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
