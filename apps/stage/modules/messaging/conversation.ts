
import type { Conversation } from '@xmtp/react-native-sdk';
import { convMembers, type ConvMembers } from '../../lib/xmtp.identity';
import { getCachedRows, getLastReadNs, getMarkedUnread } from '../../lib/channelsCache';
import { convOfLine, sdk } from '../../lib/xmtp.sdk';
import { lineOfConv } from '@stage-labs/client/xmtp/line';
import { rowMessagesOf } from '../../lib/xmtp.messages';
import { NO_TAGS, groupTagsOf, type GroupTags } from '@stage-labs/client/xmtp/labels';
import { isControlBody, type XmtpConsent } from '../../lib/xmtp.types';
import { isGroupUpdateTypeId, previewOfXmtpContent } from '@stage-labs/client/xmtp/humanize';
import { revivesClearedChat } from '@stage-labs/client/xmtp/readState';
import { channelStampSeed } from '@stage-labs/kit/avatar';
import {
  channelRowTitle, countUnreadEntries, initialMarkedUnread,
  ROW_PREVIEW_MAX_CHARS, type RowMessage, type StreamedMessage,
} from '@stage-labs/client/xmtp/summarizeRow';
import { deletedTextOf, isDeleteRequestType } from '@stage-labs/client/xmtp/deleteMessage';
import { isCallSignalType } from '@stage-labs/client/xmtp/call';
import { deletedRowBy, type DeleteRights } from '@stage-labs/client/xmtp/deletions';
import { ownDeletesReady } from '../../lib/ownDeletes';
import { fetchSuperAdmins } from './groupDetails';
import { rowCreatedTs, type ConvRow } from './convRow.model';
import type { GroupRowMeta } from '@stage-labs/client/xmtp/channelsCache';
import { dmRoutesReady, dmRowIdOf } from '../../lib/dmRoutes';
import { reported, recover } from '../../lib/errorPolicy';
import { channelConsent } from '../../lib/hiddenChannels';
export interface ConversationView extends ConvRow, GroupTags {
  convId: string;
  title: string;
  lastTs: number | null;
  createdTs?: number | null;
  lastBubbleTs: number | null;
  lastPreview: string;
  avatarAddress: string | null;
  lastSenderAddress: string | null;
  lastFromSelf: boolean;
  unreadCount: number;
  lastReadNs: number;
  markedUnread: boolean;
  consent: XmtpConsent | null;
}

function isMembershipNoise(m: RowMessage, dm: boolean): boolean {
  return dm && isGroupUpdateTypeId(m.contentTypeId);
}

function isRowCandidate(m: RowMessage, dm: boolean): boolean {
  return !(typeof m.content === 'string' && isControlBody(m.content)) && !isMembershipNoise(m, dm)
    && !isDeleteRequestType(m.contentTypeId) && !isCallSignalType(m.contentTypeId);
}

function pickLastMessage(msgs: StreamedMessage[], dm: boolean): StreamedMessage | undefined {
  return msgs.find(m => isRowCandidate(m, dm)) ?? msgs[0];
}

const ROW_LOOKBACK = 20;

async function recentRowMessages(conv: Conversation, dm: boolean): Promise<StreamedMessage[]> {
  const limit = dm ? 6 : 2;
  const msgs = await rowMessagesOf(conv, limit).catch(recover('conversation.rowMessages', []));
  const onlyHidden = msgs.length === limit && msgs.every(m => isDeleteRequestType(m.contentTypeId) || isCallSignalType(m.contentTypeId));
  return onlyHidden ? rowMessagesOf(conv, ROW_LOOKBACK).catch(recover('conversation.rowMessages', msgs)) : msgs;
}

function lastBubbleTsOf(msgs: RowMessage[], dm: boolean): number | null {
  const bubble = msgs.find(m => isRowCandidate(m, dm) && revivesClearedChat(m.contentTypeId));
  return bubble?.sentNs ? Math.floor(bubble.sentNs / 1_000_000) : null;
}

const NO_SUPER_ADMINS: ReadonlySet<string> = new Set();

async function rowDeleteRights(
  conv: Conversation, dm: boolean, msgs: StreamedMessage[], inboxToAddr: Record<string, string>, selfInboxId: string,
): Promise<DeleteRights> {
  const hasRequests = !dm && msgs.some(m => isDeleteRequestType(m.contentTypeId));
  const [ownDeletes, superAdmins] = await Promise.all([
    ownDeletesReady(),
    hasRequests ? fetchSuperAdmins(conv.id, inboxToAddr).catch(recover('conversation.superAdmins', NO_SUPER_ADMINS)) : NO_SUPER_ADMINS,
  ]);
  return { ownDeletes, superAdmins, selfInboxId };
}

function previewOfMessage(
  last: StreamedMessage | undefined, dm: boolean, msgs: StreamedMessage[], rights: DeleteRights,
): string {
  if (!last || isMembershipNoise(last, dm)) return '';
  const deletedBy = deletedRowBy(last, msgs, rights);
  if (deletedBy) return deletedTextOf(deletedBy);
  try { return previewOfXmtpContent(last.content, last.contentTypeId); }
  catch { return `[${last.contentTypeId ?? 'unknown'}]`; }
}

interface GroupRowData {
  memberAddresses: string[];
  groupMeta: { name: string; imageUrl: string };
  tags: GroupTags;
}

async function gatherGroupRowData(conv: Conversation, members: ConvMembers): Promise<GroupRowData> {
  if (members.peerAddress) {
    return { memberAddresses: [], groupMeta: { name: '', imageUrl: '' }, tags: NO_TAGS };
  }
  const [groupMeta, tags] = await Promise.all([sdk.groupInfo(conv), groupTagsOf(conv)]);
  return { memberAddresses: members.otherAddresses, groupMeta, tags };
}

function rowAvatar(
  conv: Conversation, peerAddress: string | null, groupImageUrl: string,
): { avatarUri: string | null; avatarAddress: string | null } {
  const avatarUri = peerAddress ? null : (groupImageUrl.trim() || null);
  const avatarAddress = peerAddress ?? (avatarUri ? null : channelStampSeed(conv.id));
  return { avatarUri, avatarAddress };
}

function rowMetaOf(conv: Conversation, peerAddress: string | null, data: GroupRowData): GroupRowMeta {
  const topic: string | undefined = conv.topic;
  const title = channelRowTitle({
    peerAddress, groupName: data.groupMeta.name,
    memberCount: data.memberAddresses.length,
    fallbackId: (topic ?? conv.id).replace(/^.*\//, ''),
  });
  return { title, groupName: data.groupMeta.name, ...rowAvatar(conv, peerAddress, data.groupMeta.imageUrl), ...data.tags };
}

export async function groupRowMeta(conv: Conversation): Promise<GroupRowMeta> {
  const members = await convMembers(conv);
  return { ...rowMetaOf(conv, null, await gatherGroupRowData(conv, members)), inboxToAddr: members.inboxToAddr };
}

export async function fetchConvRow(convId: string): Promise<ConvRow | null> {
  const conv = await convOfLine(lineOfConv(convId));
  if (!conv) return null;
  const members = await convMembers(conv);
  const { groupName, avatarUri } = rowMetaOf(conv, members.peerAddress, await gatherGroupRowData(conv, members));
  const selfInboxId = (await sdk.client()).inboxId ?? '';
  return { peerAddress: members.peerAddress, groupName, avatarUri, inboxToAddr: members.inboxToAddr, selfInboxId };
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

function createdTsOf(conv: Conversation, convId: string): Promise<number | null> {
  return rowCreatedTs(
    conv, convId, getCachedRows()?.find(row => row.convId === convId)?.createdTs,
    id => convOfLine(lineOfConv(id)), sdk.createdAtNs,
  );
}

const NO_KNOWN_DMS: ReadonlyMap<string, string> = new Map();

export async function summarizeConversation(
  conv: Conversation, selfInboxId: string, alreadySynced = false, knownDmIds = NO_KNOWN_DMS,
): Promise<ConversationView> {
  if (!alreadySynced) await conv.sync().catch(reported('conversation.sync'));
  const consent = sdk.consentOf(conv).catch(recover('conversation.consent', null));
  const members = await convMembers(conv);
  const { peerAddress, inboxToAddr } = members;
  await dmRoutesReady().catch(reported('conversation.dmRoutes'));
  const convId = dmRowIdOf(conv.id, peerAddress, knownDmIds);
  const dm = peerAddress !== null;
  const msgs = await recentRowMessages(conv, dm);
  const last = pickLastMessage(msgs, dm);
  const preview = previewOfMessage(last, dm, msgs, await rowDeleteRights(conv, dm, msgs, inboxToAddr, selfInboxId));
  const { title, groupName, avatarUri, avatarAddress, labels, category, status, priority, assigned } = rowMetaOf(
    conv, peerAddress, await gatherGroupRowData(conv, members),
  );
  const lastSenderAddress = lastSenderAddressOf(last, inboxToAddr);
  const lastFromSelf = !!last && last.senderInboxId === selfInboxId;
  const lastReadNs = await getLastReadNs(convId);
  const unreadCount = countUnreadEntries(msgs, lastReadNs, selfInboxId);
  const markedUnread = await resolveMarkedUnread(convId, {
    lastReadNs, unreadCount, hasLast: !!last && !isGroupUpdateTypeId(last.contentTypeId), lastFromSelf,
  });
  return {
    convId,
    title,
    groupName,
    lastTs: last?.sentNs ? Math.floor(last.sentNs / 1_000_000) : null,
    createdTs: await createdTsOf(conv, convId),
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
    category,
    status,
    priority,
    assigned,
    consent: dm ? await consent : channelConsent(conv.id, await consent),
  };
}
