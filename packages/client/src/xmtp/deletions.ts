import type { HistoryEntry } from '../types';
import { isSystemEntry } from './envelope';
import { isGroupUpdateTypeId } from './humanize';
import {
  DELETED_MESSAGE_TYPE_ID, DELETE_MESSAGE_TYPE_ID, deleteTargetOfContent, isDeleteRequestType,
  isDeletedPlaceholderType, shortTypeId, type DeletedBy,
} from './deleteMessage';
import type { StreamedMessage } from './summarizeRow';

interface DeletionPayload { contentType?: string; deletes?: string; deletedBy?: DeletedBy }

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

export function isDeletableEntry(entry: HistoryEntry): boolean {
  return !isSystemEntry(entry) && !isDeleteRequest(entry) && !isDeletedPlaceholder(entry);
}

function senderDeleteTarget(request: HistoryEntry, byId: ReadonlyMap<string, HistoryEntry>): string | null {
  const target = deletionPayloadOf(request)?.deletes;
  if (target === undefined) return null;
  const original = byId.get(target);
  return original !== undefined && original.from === request.from && isDeletableEntry(original) ? target : null;
}

export function deletedMessageIds(
  entries: readonly HistoryEntry[], ownDeletes: ReadonlySet<string> = NO_IDS,
): Set<string> {
  const byId = new Map(entries.map(e => [e.id, e]));
  const out = new Set<string>();
  for (const e of entries) {
    if (isDeletedPlaceholder(e) || ownDeletes.has(e.id)) out.add(e.id);
    const target = isDeleteRequest(e) ? senderDeleteTarget(e, byId) : null;
    if (target !== null) out.add(target);
  }
  return out;
}

export function deletedEntryView(entry: HistoryEntry): HistoryEntry {
  return {
    id: entry.id, ts: entry.ts, station: entry.station, line: entry.line, from: entry.from, to: entry.to,
    messageId: entry.messageId,
    payload: { contentType: DELETED_MESSAGE_TYPE_ID, deletedBy: deletionPayloadOf(entry)?.deletedBy ?? 'sender' },
  };
}

export function isDeletedRowMessage(
  last: StreamedMessage, recent: readonly StreamedMessage[], ownDeletes: ReadonlySet<string> = NO_IDS,
): boolean {
  if (isDeletedPlaceholderType(last.contentTypeId) || ownDeletes.has(last.id)) return true;
  if (isGroupUpdateTypeId(shortTypeId(last.contentTypeId))) return false;
  return recent.some(m => isDeleteRequestType(m.contentTypeId)
    && m.senderInboxId === last.senderInboxId
    && deleteTargetOfContent(m.content) === last.id);
}
