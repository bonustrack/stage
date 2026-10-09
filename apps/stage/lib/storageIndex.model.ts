import {
  deleteTargetOfContent, isDeleteRequestType, isDeletedPlaceholderType, shortTypeId,
} from '@stage-labs/client/xmtp/deleteMessage';
import type { StreamedMessage } from '@stage-labs/client/xmtp/summarizeRow';

export const FILE_PAGE_SIZE = 20;
export const DELETED_LIMIT = 2_000;
export const CURSOR_MARGIN_NS = 60_000_000_000;
export const PAGE_OVERLAP_NS = 1_000;

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

export interface ScannedMessage extends StreamedMessage { convId: string }

export interface ForeignDelete { convId: string; target: string; by: string }

export interface ScanFindings {
  files: StoredFile[];
  deletedIds: string[];
  foreignDeletes: ForeignDelete[];
}

export const NO_FINDINGS: ScanFindings = { files: [], deletedIds: [], foreignDeletes: [] };

interface FilePart { name?: unknown; size?: unknown }

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

function base64Bytes(data: string): number {
  const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor(data.length * 3 / 4) - padding);
}

function inlineSize(content: { content?: unknown; data?: unknown }): number {
  if (content.content instanceof Uint8Array) return content.content.length;
  return typeof content.data === 'string' ? base64Bytes(content.data) : Number.NaN;
}

function objectOf(content: unknown): Record<string, unknown> | null {
  return typeof content === 'object' && content !== null ? content as Record<string, unknown> : null;
}

function partsOf(typeId: string, content: Record<string, unknown>): FilePart[] {
  if (typeId === 'attachment') return [{ name: content.filename, size: inlineSize(content) }];
  if (typeId === 'remoteStaticAttachment') return [{ name: content.filename, size: byteCount(content.contentLength) }];
  if (typeId !== 'multiRemoteStaticAttachment' && typeId !== 'multiRemoteAttachment') return [];
  const list = Array.isArray(content.attachments) ? content.attachments as unknown[] : [];
  return list.map((item) => {
    const info = objectOf(item) ?? {};
    return { name: info.filename, size: byteCount(info.contentLength) };
  });
}

function fileName(name: unknown, index: number, count: number): string {
  if (typeof name === 'string' && name.trim() !== '') return name.trim();
  return count > 1 ? `attachment-${index + 1}` : 'attachment';
}

export function filesOfMessage(m: ScannedMessage): StoredFile[] {
  const content = objectOf(m.content);
  if (content === null) return [];
  const parts = partsOf(shortTypeId(m.contentTypeId), content);
  const sentMs = Math.floor(m.sentNs / 1_000_000);
  return parts.map((part, index) => {
    const size = byteCount(part.size);
    return {
      messageId: m.id, convId: m.convId, index, sentMs,
      name: fileName(part.name, index, parts.length),
      size: Number.isFinite(size) && size >= 0 ? size : 0,
    };
  });
}

export function findingsOf(messages: readonly ScannedMessage[], selfInboxId: string): ScanFindings {
  const files: StoredFile[] = [];
  const deletedIds: string[] = [];
  const foreignDeletes: ForeignDelete[] = [];
  for (const m of messages) {
    if (isDeletedPlaceholderType(m.contentTypeId)) { deletedIds.push(m.id); continue; }
    if (isDeleteRequestType(m.contentTypeId)) {
      const target = deleteTargetOfContent(m.content);
      if (target === undefined) continue;
      if (m.senderInboxId === selfInboxId) deletedIds.push(target);
      else foreignDeletes.push({ convId: m.convId, target, by: m.senderInboxId });
      continue;
    }
    if (m.senderInboxId === selfInboxId) files.push(...filesOfMessage(m));
  }
  return { files, deletedIds, foreignDeletes };
}

export function joinFindings(a: ScanFindings, b: ScanFindings): ScanFindings {
  if (b === NO_FINDINGS) return a;
  if (a === NO_FINDINGS) return b;
  return {
    files: [...a.files, ...b.files],
    deletedIds: [...a.deletedIds, ...b.deletedIds],
    foreignDeletes: [...a.foreignDeletes, ...b.foreignDeletes],
  };
}

export function deletesToCheck(index: StorageIndex, findings: ScanFindings): ForeignDelete[] {
  if (findings.foreignDeletes.length === 0) return [];
  const chatOf = new Map([...index.files, ...findings.files].map(f => [f.messageId, f.convId]));
  return findings.foreignDeletes.filter(d => chatOf.get(d.target) === d.convId);
}

export function newestFirst(a: StoredFile, b: StoredFile): number {
  if (a.sentMs !== b.sentMs) return b.sentMs - a.sentMs;
  if (a.messageId !== b.messageId) return a.messageId < b.messageId ? -1 : 1;
  return a.index - b.index;
}

function withDeleted(deleted: readonly string[], ids: readonly string[]): string[] {
  if (ids.length === 0) return [...deleted];
  const fresh = ids.filter(id => !deleted.includes(id));
  return [...deleted, ...new Set(fresh)].slice(-DELETED_LIMIT);
}

export function applyFindings(index: StorageIndex, findings: Pick<ScanFindings, 'files' | 'deletedIds'>): StorageIndex {
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

function sameList<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((item, i) => item === b[i]);
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

function isStoredFile(value: unknown): value is StoredFile {
  const f = objectOf(value);
  return f !== null && typeof f.messageId === 'string' && typeof f.convId === 'string' && typeof f.name === 'string'
    && typeof f.index === 'number' && typeof f.size === 'number' && typeof f.sentMs === 'number';
}

export function indexRecord(index: StorageIndex): Record<string, unknown> {
  return { v: 1, ...index };
}

function retryOf(value: unknown): Record<string, number> {
  const entries = Object.entries(objectOf(value) ?? {});
  return Object.fromEntries(entries.filter((e): e is [string, number] => typeof e[1] === 'number'));
}

export function indexOfRecord(raw: unknown): StorageIndex | null {
  const o = objectOf(raw);
  if (o === null || o.v !== 1 || typeof o.inboxId !== 'string' || typeof o.cursorNs !== 'number') return null;
  const files = Array.isArray(o.files) ? o.files.filter(isStoredFile) : [];
  const deleted = Array.isArray(o.deleted) ? o.deleted.filter((id): id is string => typeof id === 'string') : [];
  return { inboxId: o.inboxId, cursorNs: o.cursorNs, files: files.sort(newestFirst), deleted, retry: retryOf(o.retry) };
}

export function encodeIndex(index: StorageIndex): string {
  return JSON.stringify(indexRecord(index));
}

export function decodeIndex(text: string): StorageIndex | null {
  try { return indexOfRecord(JSON.parse(text)); } catch { return null; }
}
