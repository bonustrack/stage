import { deleteTargetOfContent, isDeleteRequestType, isDeletedPlaceholderType } from '@stage-labs/client/xmtp/deleteMessage';
import { deletedRowBy, type DeleteRights } from '@stage-labs/client/xmtp/deletions';
import type { StreamedMessage } from '@stage-labs/client/xmtp/summarizeRow';
import { attachedFilesOf } from '@stage-labs/client/xmtp/contentTypes';
import { z } from 'zod';
import { jsonWith, sameList, storedRecordOf, storedStrings } from './storeCore';

export const FILE_PAGE_SIZE = 20;
export const DELETED_LIMIT = 2_000;
const CURSOR_MARGIN_NS = 60_000_000_000;
const PAGE_OVERLAP_NS = 1_000;

export interface StoredFile {
  messageId: string;
  convId: string;
  index: number;
  name: string;
  size: number;
  sentMs: number;
}

export interface StorageIndex {
  inboxId: string;
  cursorNs: number;
  files: StoredFile[];
  deleted: string[];
  retry: Record<string, number>;
}

export interface ScannedMessage extends StreamedMessage {
  convId: string;
}

export interface ScanFindings {
  files: StoredFile[];
  deletedIds: string[];
  deleteRequests: ScannedMessage[];
}

export type SettledFindings = Pick<ScanFindings, 'files' | 'deletedIds'>;

export const NO_FINDINGS: ScanFindings = { files: [], deletedIds: [], deleteRequests: [] };

export const NO_DELETE_RIGHTS: DeleteRights = {};

export function emptyIndex(inboxId: string): StorageIndex {
  return { inboxId, cursorNs: 0, files: [], deleted: [], retry: {} };
}

export function fileKey(file: Pick<StoredFile, 'messageId' | 'index'>): string {
  return `${file.messageId}:${file.index}`;
}

function byteCount(value: unknown): number {
  if (typeof value === 'number' || typeof value === 'bigint') return Number(value);
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
  return Number.NaN;
}

function fileName(name: unknown, index: number, count: number): string {
  if (typeof name === 'string' && name.trim() !== '') return name.trim();
  return count > 1 ? `attachment-${index + 1}` : 'attachment';
}

export function filesOfMessage(m: ScannedMessage): StoredFile[] {
  const parts = attachedFilesOf(m.contentTypeId, m.content);
  const sentMs = Math.floor(m.sentNs / 1_000_000);
  return parts.map((part, index) => {
    const size = byteCount(part.size);
    return {
      messageId: m.id,
      convId: m.convId,
      index,
      sentMs,
      name: fileName(part.name, index, parts.length),
      size: Number.isFinite(size) && size >= 0 ? size : 0,
    };
  });
}

export function findingsOf(messages: readonly ScannedMessage[], selfInboxId: string): ScanFindings {
  const files: StoredFile[] = [];
  const deletedIds: string[] = [];
  const deleteRequests: ScannedMessage[] = [];
  for (const m of messages) {
    if (isDeletedPlaceholderType(m.contentTypeId)) deletedIds.push(m.id);
    else if (isDeleteRequestType(m.contentTypeId)) {
      if (deleteTargetOfContent(m.content) !== undefined) deleteRequests.push(m);
    } else if (m.senderInboxId === selfInboxId) files.push(...filesOfMessage(m));
  }
  return { files, deletedIds, deleteRequests };
}

export function joinFindings(a: ScanFindings, b: ScanFindings): ScanFindings {
  if (b === NO_FINDINGS) return a;
  if (a === NO_FINDINGS) return b;
  return {
    files: [...a.files, ...b.files],
    deletedIds: [...a.deletedIds, ...b.deletedIds],
    deleteRequests: [...a.deleteRequests, ...b.deleteRequests],
  };
}

function deletesToCheck(index: StorageIndex, findings: ScanFindings): ScannedMessage[] {
  if (findings.deleteRequests.length === 0) return [];
  const chatOf = new Map([...index.files, ...findings.files].map((f) => [f.messageId, f.convId]));
  return findings.deleteRequests.filter((request) => {
    const target = deleteTargetOfContent(request.content);
    return request.senderInboxId === index.inboxId || (target !== undefined && chatOf.get(target) === request.convId);
  });
}

export function needsDeleteRights(index: StorageIndex, findings: ScanFindings): boolean {
  return deletesToCheck(index, findings).some((request) => request.senderInboxId !== index.inboxId);
}

function ownOriginal(id: string, selfInboxId: string): StreamedMessage {
  return { id, senderInboxId: selfInboxId, contentTypeId: undefined, content: undefined, sentNs: 0 };
}

export function settleFindings(index: StorageIndex, findings: ScanFindings, rights: DeleteRights): SettledFindings {
  const deleted = deletesToCheck(index, findings).flatMap((request) => {
    const target = deleteTargetOfContent(request.content);
    return target !== undefined && deletedRowBy(ownOriginal(target, index.inboxId), [request], rights) !== null ? [target] : [];
  });
  return { files: findings.files, deletedIds: [...findings.deletedIds, ...deleted] };
}

export function newestFirst(a: StoredFile, b: StoredFile): number {
  if (a.sentMs !== b.sentMs) return b.sentMs - a.sentMs;
  if (a.messageId !== b.messageId) return a.messageId < b.messageId ? -1 : 1;
  return a.index - b.index;
}

function withDeleted(deleted: readonly string[], ids: readonly string[]): string[] {
  if (ids.length === 0) return [...deleted];
  return [...deleted, ...new Set(ids.filter((id) => !deleted.includes(id)))].slice(-DELETED_LIMIT);
}

export function applyFindings(index: StorageIndex, findings: SettledFindings): StorageIndex {
  if (findings.files.length === 0 && findings.deletedIds.length === 0) return index;
  const deleted = withDeleted(index.deleted, findings.deletedIds);
  const gone = new Set(deleted);
  const byKey = new Map<string, StoredFile>();
  for (const file of [...index.files, ...findings.files]) {
    if (!gone.has(file.messageId) && !byKey.has(fileKey(file))) byKey.set(fileKey(file), file);
  }
  const files = [...byKey.values()].sort(newestFirst);
  return sameList(files, index.files) && sameList(deleted, index.deleted) ? index : { ...index, files, deleted };
}

export function sinceFor(index: StorageIndex, convId: string): number {
  return index.retry[convId] ?? index.cursorNs;
}

export function finishScan(index: StorageIndex, cursorNs: number, failed: ReadonlyMap<string, number>): StorageIndex {
  return { ...index, cursorNs, retry: Object.fromEntries(failed) };
}

export function nextCursorNs(scanStartedMs: number): number {
  return scanStartedMs * 1_000_000 - CURSOR_MARGIN_NS;
}

export function nextPageBeforeNs(page: readonly { sentNs: number }[]): number | undefined {
  let oldest: number | undefined;
  for (const m of page) if (oldest === undefined || m.sentNs < oldest) oldest = m.sentNs;
  return oldest === undefined ? undefined : oldest + PAGE_OVERLAP_NS;
}

const storedFileSchema = z.object({
  messageId: z.string(),
  convId: z.string(),
  name: z.string(),
  index: z.number(),
  size: z.number(),
  sentMs: z.number(),
});

const storedFilesSchema = z
  .array(z.unknown())
  .transform((items) => items.flatMap((item) => storedFileSchema.safeParse(item).data ?? []))
  .catch([]);

const isCount = (value: unknown): value is number => typeof value === 'number';

const storedIndexSchema = z.object({
  v: z.literal(1),
  inboxId: z.string(),
  cursorNs: z.number(),
  files: storedFilesSchema,
  deleted: storedStrings.catch([]),
  retry: storedRecordOf(isCount).catch({}),
});

export function encodeIndex(index: StorageIndex): string {
  return JSON.stringify({ v: 1, ...index });
}

const parseIndex = jsonWith(storedIndexSchema);

export function decodeIndex(text: string): StorageIndex | null {
  const stored = parseIndex(text);
  if (stored === undefined) return null;
  const { inboxId, cursorNs, files, deleted, retry } = stored;
  return { inboxId, cursorNs, files: files.sort(newestFirst), deleted, retry };
}
