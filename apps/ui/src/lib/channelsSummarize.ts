/** Pure summarisation pipeline for a single XMTP conversation row. Pulled
 *  out of `pages/Channels.vue` so the view-layer file stays under the
 *  per-file cap and the summariser is unit-testable in isolation. */

import type { Conversation } from '@xmtp/browser-sdk';
import {
  peerEthAddressOfDm, groupMemberEthAddresses, memberInboxToAddressMap,
  getLastReadNs,
} from './xmtp';
import { previewOfXmtpContent } from '@shared/xmtp/humanize';

export interface ChannelRow {
  convId: string;
  title: string;
  lastTs: number | null;
  lastPreview: string;
  avatarAddress: string | null;
  inboxToAddr: Record<string, string>;
  unreadCount: number;
  lastReadNs: number;
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
  const groupName = (conv as unknown as { name?: string | (() => Promise<string>) }).name;
  const resolvedName = typeof groupName === 'function' ? await groupName() : groupName ?? '';
  const title = peerAddress
    ?? (resolvedName && resolvedName.trim()
      ? resolvedName.trim()
      : memberAddresses.length > 0
        ? `${totalMembers} member${totalMembers === 1 ? '' : 's'}`
        : conv.id.slice(0, 12));
  const lastSenderAddress = last?.senderInboxId
    ? inboxToAddr[last.senderInboxId] ?? null
    : null;
  const avatarAddress = lastSenderAddress ?? peerAddress ?? memberAddresses[0] ?? null;
  const lastReadNs = getLastReadNs(conv.id);
  let unreadCount = 0;
  for (const m of recent) {
    const sentNs = Number(m.sentAtNs);
    if (!sentNs || sentNs <= lastReadNs) break;
    if (m.senderInboxId === selfInboxId) continue;
    unreadCount += 1;
  }
  return {
    convId: conv.id,
    title,
    lastTs: last ? Number(last.sentAtNs / 1_000_000n) : null,
    lastPreview: preview.slice(0, 80),
    avatarAddress,
    inboxToAddr,
    unreadCount,
    lastReadNs,
    selfInboxId,
    peerAddress,
    memberAddresses,
  };
}
