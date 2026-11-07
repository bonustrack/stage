import { convMembers, type ConvMembers } from '../xmtp.identity';
import { getCachedRows, getLastReadNs, getMarkedUnread } from '../channelsCache';
import { sdk } from '../xmtp.sdk';
import { convOfLine } from '../xmtp.find';
import { lineOfConv } from '@stage-labs/client/xmtp/line';
import { rowMessagesOf, type ConvHandle } from '../xmtp.messages';
import { NO_TAGS, groupTagsOf, type GroupTags } from '@stage-labs/client/xmtp/channelMeta';
import { rowPreviewOf } from '@stage-labs/client/xmtp/contentTypes';
import { isRowCandidate, isSystemMessage, onlyHiddenMessages, revivesRow } from '@stage-labs/client/xmtp/visibility';
import { channelAvatar } from '../convIdentity';
import {
  channelRowTitle,
  countUnreadEntries,
  initialMarkedUnread,
  ROW_PREVIEW_MAX_CHARS,
  type RowMessage,
  type StreamedMessage,
} from '@stage-labs/client/xmtp/summarizeRow';
import { deletedTextOf, isDeleteRequestType } from '@stage-labs/client/xmtp/deleteMessage';
import { deletedRowBy, type DeleteRights } from '@stage-labs/client/xmtp/deletions';
import { deleteRightsOf } from './deleteRights';
import { rowCreatedTs, type ConvRow } from './convRow.model';
import type { GroupRowMeta } from '@stage-labs/client/xmtp/channelsCache';
import type { CachedRow } from '../cachedRows.model';
import { dmRoutesReady, dmRowIdOf } from '../dmRoutes';
import { reported, recover } from '../errorPolicy';
import { channelConsent } from '../channelVisibility';

function isMembershipNoise(m: RowMessage, dm: boolean): boolean {
  return dm && isSystemMessage(m);
}

function pickLastMessage(msgs: StreamedMessage[], dm: boolean): StreamedMessage | undefined {
  return msgs.find((m) => isRowCandidate(m, dm)) ?? msgs[0];
}

const ROW_LOOKBACK = 20;

async function recentRowMessages(conv: ConvHandle, dm: boolean): Promise<StreamedMessage[]> {
  const limit = dm ? 6 : 2;
  const msgs = await rowMessagesOf(conv, limit).catch(recover('conversation.rowMessages', []));
  const onlyHidden = msgs.length === limit && onlyHiddenMessages(msgs);
  return onlyHidden ? rowMessagesOf(conv, ROW_LOOKBACK).catch(recover('conversation.rowMessages', msgs)) : msgs;
}

function lastBubbleTsOf(msgs: RowMessage[], dm: boolean): number | null {
  const bubble = msgs.find((m) => revivesRow(m, dm));
  return bubble?.sentNs ? Math.floor(bubble.sentNs / 1_000_000) : null;
}

function rowDeleteRights(
  conv: ConvHandle,
  dm: boolean,
  msgs: StreamedMessage[],
  inboxToAddr: Record<string, string>,
  selfInboxId: string,
): Promise<DeleteRights> {
  const hasRequests = !dm && msgs.some((m) => isDeleteRequestType(m.contentTypeId));
  return deleteRightsOf(hasRequests ? { convId: conv.id, inboxToAddr, where: 'conversation.superAdmins' } : null, selfInboxId);
}

function previewOfMessage(last: StreamedMessage | undefined, dm: boolean, msgs: StreamedMessage[], rights: DeleteRights): string {
  if (!last || isMembershipNoise(last, dm)) return '';
  const deletedBy = deletedRowBy(last, msgs, rights);
  if (deletedBy) return deletedTextOf(deletedBy);
  return rowPreviewOf(last);
}

interface GroupRowData {
  memberAddresses: string[];
  groupMeta: { name: string; imageUrl: string };
  tags: GroupTags;
}

async function gatherGroupRowData(conv: ConvHandle, members: ConvMembers): Promise<GroupRowData> {
  if (members.peerAddress) {
    return { memberAddresses: [], groupMeta: { name: '', imageUrl: '' }, tags: NO_TAGS };
  }
  const [groupMeta, tags] = await Promise.all([sdk.groupInfo(conv), groupTagsOf(sdk.appDataGroup(conv))]);
  return { memberAddresses: members.otherAddresses, groupMeta, tags };
}

function rowAvatar(
  conv: ConvHandle,
  peerAddress: string | null,
  groupImageUrl: string,
): { avatarUri: string | null; avatarAddress: string | null } {
  return peerAddress ? { avatarUri: null, avatarAddress: peerAddress } : channelAvatar(conv.id, groupImageUrl);
}

function rowMetaOf(conv: ConvHandle, peerAddress: string | null, data: GroupRowData): GroupRowMeta {
  const title = channelRowTitle({ peerAddress, groupName: data.groupMeta.name, memberCount: data.memberAddresses.length });
  return { title, groupName: data.groupMeta.name, ...rowAvatar(conv, peerAddress, data.groupMeta.imageUrl), ...data.tags };
}

export async function groupRowMeta(conv: ConvHandle): Promise<GroupRowMeta> {
  const members = await convMembers(conv);
  return { ...rowMetaOf(conv, null, await gatherGroupRowData(conv, members)), inboxToAddr: members.inboxToAddr };
}

export async function fetchConvRow(convId: string): Promise<ConvRow | null> {
  const conv = await convOfLine(lineOfConv(convId));
  if (!conv) return null;
  const members = await convMembers(conv);
  const { groupName, avatarUri } = rowMetaOf(conv, members.peerAddress, await gatherGroupRowData(conv, members));
  const selfInboxId = sdk.inboxIdOf(await sdk.client());
  return { peerAddress: members.peerAddress, groupName, avatarUri, inboxToAddr: members.inboxToAddr, selfInboxId };
}

function lastSenderAddressOf(last: RowMessage | undefined, inboxToAddr: Record<string, string>): string | null {
  return last?.senderInboxId ? (inboxToAddr[last.senderInboxId] ?? null) : null;
}

async function resolveMarkedUnread(convId: string, inputs: Parameters<typeof initialMarkedUnread>[0]): Promise<boolean> {
  if (await getMarkedUnread(convId)) return true;
  return initialMarkedUnread(inputs);
}

function createdTsOf(conv: ConvHandle, convId: string): Promise<number | null> {
  return rowCreatedTs(
    conv,
    convId,
    getCachedRows()?.find((row) => row.convId === convId)?.createdTs,
    (id) => convOfLine(lineOfConv(id)),
    sdk.createdAtNs,
  );
}

const NO_KNOWN_DMS: ReadonlyMap<string, string> = new Map();

export async function summarizeConversation(
  conv: ConvHandle,
  selfInboxId: string,
  alreadySynced: boolean,
  knownDmIds = NO_KNOWN_DMS,
): Promise<CachedRow> {
  if (!alreadySynced) await sdk.syncConv(conv).catch(reported('conversation.sync'));
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
    conv,
    peerAddress,
    await gatherGroupRowData(conv, members),
  );
  const lastSenderAddress = lastSenderAddressOf(last, inboxToAddr);
  const lastFromSelf = !!last && last.senderInboxId === selfInboxId;
  const lastReadNs = await getLastReadNs(convId);
  const unreadCount = countUnreadEntries(msgs, lastReadNs, selfInboxId);
  const markedUnread = await resolveMarkedUnread(convId, {
    lastReadNs,
    unreadCount,
    hasLast: !!last && !isSystemMessage(last),
    lastFromSelf,
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
    consent: channelConsent(conv.id, !dm, await consent),
  };
}
