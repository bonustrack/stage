/** Conversation-list domain types + adapters, behind the facade. Owns
 *  `ConversationView` (channels-list row) + `ConversationRequestView` (lighter
 *  message-request row) and adapters that summarise a raw XMTP `Conversation`
 *  into those shapes, so components consume domain types instead of leaking raw
 *  SDK types (`Conversation` / `DecodedMessage`) into the component tree. */

import type { Conversation, DecodedMessage } from '@xmtp/react-native-sdk';
import {
  peerEthAddressOfDm, groupMemberEthAddresses, memberInboxToAddressMap,
  shortAddress, getLastReadNs,
} from '../../lib/xmtp';
import { labelsOfSyncedGroup } from '../../lib/xmtp.labels';
import { githubOfSyncedGroup } from '../../lib/xmtp.github';
import { isMetroControlBody } from '../../lib/push';
import { previewOfXmtpContent } from '@stage-labs/client/xmtp/humanize';
import { channelStampSeed } from '@metro-labs/kit/avatar';
import type {
  ConversationView, ConversationRequestView, RequestAvatarDescriptor,
} from './conversation.types';

export type {
  ConversationView, ConversationRequestView, RequestAvatarDescriptor,
} from './conversation.types';

/** Summarise a raw conversation into the full channels-list domain view. Moved
 *  UNCHANGED from HomeScreen.helpers.summarize. */
export async function summarizeConversation(
  conv: Conversation, selfInboxId: string,
): Promise<ConversationView> {
  await conv.sync().catch(() => undefined);
  /** Pull only the latest message for the row PREVIEW - the unread count is
   *  maintained incrementally from the live stream deltas. We fetch 2 so a
   *  trailing control DM doesn't blank the preview. */
  const recent: DecodedMessage[] = await conv.messages({ limit: 2 }).catch(() => []);
  const msgs = recent;
  /** Skip our own register-push control DMs when choosing the "last message". */
  const last = msgs.find(m => {
    try { const c: unknown = m.content(); return !(typeof c === 'string' && isMetroControlBody(c)); }
    catch { return true; }
  }) ?? msgs[0];
  let preview = '';
  if (last) {
    try { preview = previewOfXmtpContent(last.content(), last.contentTypeId); }
    catch { preview = `[${last.contentTypeId ?? 'unknown'}]`; }
  }
  const peerAddress = await peerEthAddressOfDm(conv);
  const memberAddresses = peerAddress ? [] : await groupMemberEthAddresses(conv);
  const inboxToAddr = await memberInboxToAddressMap(conv);
  const totalMembers = memberAddresses.length + 1;
  /** Read group metadata (name + uploaded image) in one shot for groups. */
  const groupMeta = peerAddress
    ? { name: '', imageUrl: '' }
    : await (async (): Promise<{ name: string; imageUrl: string }> => {
        const g = conv as unknown as { name?: () => Promise<string>; imageUrl?: () => Promise<string> };
        const [n, img] = await Promise.all([
          g.name?.() ?? Promise.resolve(''),
          g.imageUrl?.().catch(() => '') ?? Promise.resolve(''),
        ]);
        return { name: n ?? '', imageUrl: img ?? '' };
      })();
  /** Group labels (DMs have none). Read off the conv synced above. */
  const labels = peerAddress ? [] : await labelsOfSyncedGroup(conv);
  const github = peerAddress ? undefined : await githubOfSyncedGroup(conv);
  const title = peerAddress
    ? shortAddress(peerAddress)
    : (groupMeta.name.trim()
      ? groupMeta.name.trim()
      : memberAddresses.length > 0
        ? `${totalMembers} member${totalMembers === 1 ? '' : 's'}`
        : conv.topic.replace(/^.*\//, '').slice(0, 12));
  const lastSenderAddress = last?.senderInboxId
    ? inboxToAddr[last.senderInboxId] ?? null
    : null;
  const lastFromSelf = !!last && last.senderInboxId === selfInboxId;
  const avatarUri = peerAddress ? null : (groupMeta.imageUrl.trim() || null);
  const avatarAddress = peerAddress
    ?? (avatarUri ? null : channelStampSeed(conv.id));
  const lastReadNs = await getLastReadNs(conv.id);
  let unreadCount = 0;
  for (const m of msgs) {
    if (!m.sentNs || m.sentNs <= lastReadNs) break;
    if (m.senderInboxId === selfInboxId) continue;
    unreadCount += 1;
  }
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

/** Summarise a raw conversation into the message-request domain view. Moved
 *  UNCHANGED from app/xmtp/requests.summarizeRequest. */
export async function summarizeConversationRequest(
  conv: Conversation,
): Promise<ConversationRequestView> {
  await conv.sync().catch(() => undefined);
  const peerAddress = await peerEthAddressOfDm(conv);
  const isGroup = !peerAddress;
  const memberAddresses = isGroup ? await groupMemberEthAddresses(conv) : [];
  const g = conv as unknown as { name?: () => Promise<string>; imageUrl?: () => Promise<string> };
  const groupName = isGroup
    ? await g.name?.().catch(() => '') ?? ''
    : '';
  const groupImage = isGroup
    ? (await g.imageUrl?.().catch(() => '') ?? '').trim()
    : '';
  const recent: DecodedMessage[] = await conv.messages({ limit: 1 }).catch(() => []);
  const last = recent[0];
  let preview = '';
  if (last) {
    try { preview = previewOfXmtpContent(last.content(), last.contentTypeId); }
    catch { preview = `[${last.contentTypeId ?? 'unknown'}]`; }
  }
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

/** Lightweight avatar-only descriptor for a message request (the notifications
 *  preview pile). Moved UNCHANGED from useRequestPreviews.describe: resolves the
 *  DM peer / group image only - deliberately NO conv.sync()/messages() round-trip
 *  (the pile only needs avatars). */
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
