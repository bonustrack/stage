import type { HistoryEntry } from '../types';
import { isSystemEntry } from './envelope';
import { LEAVE_REQUEST_TYPE_ID, isGroupUpdateTypeId } from './humanize';
import { XMTP_USER_PREFIX } from './line';
import {
  DELETED_MESSAGE_TYPE_ID, DELETE_MESSAGE_TYPE_ID, deleteTargetOfContent, deletedByOfContent, isDeleteRequestType,
  isDeletedPlaceholderType, shortTypeId, type DeletedBy,
} from './deleteMessage';
import type { StreamedMessage } from './summarizeRow';

interface DeletionPayload { contentType?: string; deletes?: string; deletedBy?: DeletedBy }

export interface DeleteRights {
  ownDeletes?: ReadonlySet<string>;
  superAdmins?: ReadonlySet<string>;
  selfInboxId?: string | null;
}

export type DeletedMessages = ReadonlyMap<string, DeletedBy>;

const NO_IDS: ReadonlySet<string> = new Set();

function deletionPayloadOf(entry: HistoryEntry): DeletionPayload | undefined {
  return entry.payload as DeletionPayload | undefined;
}

export function isDeleteRequest(entry: HistoryEntry): boolean {
  return deletionPayloadOf(entry)?.contentType === DELETE_MESSAGE_TYPE_ID;
}

export function isDeletedPlaceholder(entry: HistoryEntry): boolean {
  return deletionPayloadOf(entry)?.contentType === DELETED_MESSAGE_TYPE_ID;
}

export function deletedByOf(entry: HistoryEntry): DeletedBy {
  return deletionPayloadOf(entry)?.deletedBy ?? 'sender';
}

export function isDeletableEntry(entry: HistoryEntry): boolean {
  return !isSystemEntry(entry) && !isDeleteRequest(entry) && !isDeletedPlaceholder(entry);
}

function inboxIdOf(from: string): string {
  return from.startsWith(XMTP_USER_PREFIX) ? from.slice(XMTP_USER_PREFIX.length) : '';
}

function deleteAuthority(
  sameSender: boolean, deleterInboxId: string, superAdmins: ReadonlySet<string>,
): DeletedBy | null {
  if (sameSender) return 'sender';
  return deleterInboxId !== '' && superAdmins.has(deleterInboxId.toLowerCase()) ? 'admin' : null;
}

function ownDeleteBy(senderInboxId: string, selfInboxId: string | null | undefined): DeletedBy {
  return selfInboxId && senderInboxId !== selfInboxId ? 'admin' : 'sender';
}

function requestDeletion(
  request: HistoryEntry, byId: ReadonlyMap<string, HistoryEntry>, superAdmins: ReadonlySet<string>,
): [string, DeletedBy] | null {
  const target = deletionPayloadOf(request)?.deletes;
  const original = target === undefined ? undefined : byId.get(target);
  if (target === undefined || original === undefined || !isDeletableEntry(original)) return null;
  const by = deleteAuthority(original.from === request.from, inboxIdOf(request.from), superAdmins);
  return by === null ? null : [target, by];
}

function entryDeletion(entry: HistoryEntry, rights: DeleteRights): DeletedBy | null {
  if (isDeletedPlaceholder(entry)) return deletedByOf(entry);
  if (rights.ownDeletes?.has(entry.id)) return ownDeleteBy(inboxIdOf(entry.from), rights.selfInboxId);
  return null;
}

export function deletedMessages(entries: readonly HistoryEntry[], rights: DeleteRights = {}): Map<string, DeletedBy> {
  const byId = new Map(entries.map(e => [e.id, e]));
  const out = new Map<string, DeletedBy>();
  const mark = (id: string, by: DeletedBy | null): void => {
    if (by === 'sender' || (by === 'admin' && !out.has(id))) out.set(id, by);
  };
  for (const e of entries) {
    mark(e.id, entryDeletion(e, rights));
    const hit = isDeleteRequest(e) ? requestDeletion(e, byId, rights.superAdmins ?? NO_IDS) : null;
    if (hit !== null) mark(...hit);
  }
  return out;
}

export function deletedEntryView(entry: HistoryEntry, by: DeletedBy = deletedByOf(entry)): HistoryEntry {
  return {
    id: entry.id, ts: entry.ts, station: entry.station, line: entry.line, from: entry.from, to: entry.to,
    messageId: entry.messageId,
    payload: { contentType: DELETED_MESSAGE_TYPE_ID, deletedBy: by },
  };
}

export function deletedRowBy(
  last: StreamedMessage, recent: readonly StreamedMessage[], rights: DeleteRights = {},
): DeletedBy | null {
  if (isDeletedPlaceholderType(last.contentTypeId)) return deletedByOfContent(last.content);
  if (rights.ownDeletes?.has(last.id)) return ownDeleteBy(last.senderInboxId, rights.selfInboxId);
  const typeId = shortTypeId(last.contentTypeId);
  if (isGroupUpdateTypeId(typeId) || typeId === LEAVE_REQUEST_TYPE_ID) return null;
  const found = recent
    .filter(m => isDeleteRequestType(m.contentTypeId) && deleteTargetOfContent(m.content) === last.id)
    .map(m => deleteAuthority(m.senderInboxId === last.senderInboxId, m.senderInboxId, rights.superAdmins ?? NO_IDS));
  if (found.includes('sender')) return 'sender';
  return found.includes('admin') ? 'admin' : null;
}
