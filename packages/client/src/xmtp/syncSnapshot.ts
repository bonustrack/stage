import { z } from 'zod';
import type { CachedChannelRow } from './channelsCache';
import type { XmtpContentTypeId } from './codecs';
import {
  BOARD_STATE_CONTENT_TYPE, CLEAR_STATE_CONTENT_TYPE, PIN_STATE_CONTENT_TYPE, READ_STATE_CONTENT_TYPE,
  collectSyncReplay, isBoardStateType, isClearStateType, isPinStateType, isReadStateType,
  type ClearedChats, type SyncMessage, type SyncReplay,
} from './readState';

export const SYNC_SNAPSHOT_CONTENT_TYPE: XmtpContentTypeId = {
  authorityId: 'stage.box', typeId: 'syncSnapshot', versionMajor: 1, versionMinor: 0,
};

export const UNSTAMPED_AT = 1;

const idSchema = z.string().min(1);
const atSchema = z.number().positive();

const snapshotReadSchema = z.object({
  lastReadNs: z.number().nonnegative(),
  markedUnread: z.boolean(),
  at: atSchema,
});

export type SnapshotRead = z.infer<typeof snapshotReadSchema>;

const readStateFileSchema = z.object({
  legacy: z.boolean(),
  reads: z.record(idSchema, snapshotReadSchema),
});

export type ReadStateFile = z.infer<typeof readStateFileSchema>;

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export function parseReadStateFile(raw: string): ReadStateFile | null {
  const parsed = readStateFileSchema.safeParse(parseJson(raw));
  return parsed.success ? parsed.data : null;
}

export const syncSnapshotSchema = z.object({
  reads: z.record(idSchema, snapshotReadSchema),
  pins: z.object({ convId: idSchema, pinned: z.boolean(), order: z.array(idSchema), at: atSchema }).nullable(),
  cleared: z.record(idSchema, z.number().nonnegative()),
  board: z.object({ order: z.array(idSchema), at: atSchema }).nullable(),
  at: atSchema,
});

export type SyncSnapshotContent = z.infer<typeof syncSnapshotSchema>;

export function syncSnapshotFallbackText(): string {
  return 'Stage sync snapshot';
}

export function isSyncSnapshotType(contentTypeId: string | undefined): boolean {
  return typeof contentTypeId === 'string' && contentTypeId.includes(SYNC_SNAPSHOT_CONTENT_TYPE.typeId);
}

export function parseSyncSnapshot(content: unknown): SyncSnapshotContent | null {
  const parsed = syncSnapshotSchema.safeParse(content);
  return parsed.success ? parsed.data : null;
}

const SYNC_STATE_TYPES = [isReadStateType, isPinStateType, isClearStateType, isBoardStateType, isSyncSnapshotType];

export function isSyncStateType(contentTypeId: string | undefined): boolean {
  return SYNC_STATE_TYPES.some((isType) => isType(contentTypeId));
}

export const SNAPSHOT_EVERY = 200;

export function snapshotDue(changesSinceSnapshot: number): boolean {
  return changesSinceSnapshot >= SNAPSHOT_EVERY;
}

function typeString(type: XmtpContentTypeId): string {
  return `${type.authorityId}/${type.typeId}:${String(type.versionMajor)}.${String(type.versionMinor)}`;
}

function expandSnapshot(snapshot: SyncSnapshotContent, sentNs: number): SyncMessage[] {
  const at = (contentTypeId: string, content: unknown): SyncMessage => ({ contentTypeId, content, sentNs });
  const reads = Object.entries(snapshot.reads)
    .map(([convId, read]) => at(typeString(READ_STATE_CONTENT_TYPE), { convId, ...read }));
  const pins = snapshot.pins === null ? [] : [at(typeString(PIN_STATE_CONTENT_TYPE), snapshot.pins)];
  const board = snapshot.board === null ? [] : [at(typeString(BOARD_STATE_CONTENT_TYPE), snapshot.board)];
  return [...reads, ...pins, at(typeString(CLEAR_STATE_CONTENT_TYPE), { cleared: snapshot.cleared }), ...board];
}

export function expandSyncSnapshots(messages: readonly SyncMessage[]): SyncMessage[] {
  return messages.flatMap((m) => {
    const snapshot = isSyncSnapshotType(m.contentTypeId) ? parseSyncSnapshot(m.content) : null;
    return snapshot === null ? [m] : expandSnapshot(snapshot, m.sentNs);
  });
}

export function collectSnapshotReplay(messages: readonly SyncMessage[], afterNs: number): SyncReplay {
  return collectSyncReplay(expandSyncSnapshots(messages), afterNs);
}

export const SYNC_PAGE_SIZE = 200;
export const SYNC_SCAN_CAP = 5000;
export const SNAPSHOT_OVERLAP_NS = 60_000_000_000;

export interface SyncPageMessage extends SyncMessage {
  id: string;
}

export type FetchSyncPage<M extends SyncPageMessage> = (limit: number, beforeMs: number | undefined) => Promise<M[]>;

export interface SyncScan<M extends SyncPageMessage> {
  messages: M[];
  snapshotNs: number | null;
}

function newestSnapshotNs(messages: readonly SyncMessage[]): number | null {
  let newest: number | null = null;
  for (const m of messages) {
    const valid = isSyncSnapshotType(m.contentTypeId) && parseSyncSnapshot(m.content) !== null;
    if (valid && (newest === null || m.sentNs > newest)) newest = m.sentNs;
  }
  return newest;
}

function oldestNs(messages: readonly SyncMessage[]): number {
  return messages.reduce((min, m) => Math.min(min, m.sentNs), Number.POSITIVE_INFINITY);
}

interface ScanCursor {
  limit: number;
  beforeMs: number | undefined;
  floor: number;
  snapshotNs: number | null;
}

function nextCursor<M extends SyncPageMessage>(
  cursor: ScanCursor, page: readonly M[], fresh: readonly M[], afterNs: number,
): ScanCursor {
  const snapshotNs = cursor.snapshotNs ?? newestSnapshotNs(fresh);
  const floor = snapshotNs === null ? afterNs : Math.max(afterNs, snapshotNs - SNAPSHOT_OVERLAP_NS);
  if (fresh.length === 0) return { ...cursor, limit: cursor.limit * 2 };
  return { ...cursor, floor, snapshotNs, beforeMs: Math.floor(oldestNs(page) / 1_000_000) + 1 };
}

function scanDone(page: readonly SyncMessage[], cursor: ScanCursor, seen: number): boolean {
  return page.length < cursor.limit || oldestNs(page) <= cursor.floor || seen >= SYNC_SCAN_CAP
    || cursor.limit > SYNC_SCAN_CAP;
}

export async function scanSyncHistory<M extends SyncPageMessage>(
  fetchPage: FetchSyncPage<M>, afterNs: number,
): Promise<SyncScan<M>> {
  const seen = new Map<string, M>();
  let cursor: ScanCursor = { limit: SYNC_PAGE_SIZE, beforeMs: undefined, floor: afterNs, snapshotNs: null };
  for (;;) {
    const page = await fetchPage(cursor.limit, cursor.beforeMs);
    const fresh = page.filter((m) => !seen.has(m.id));
    for (const m of fresh) seen.set(m.id, m);
    const limit = cursor.limit;
    cursor = nextCursor(cursor, page, fresh, afterNs);
    if (scanDone(page, { ...cursor, limit }, seen.size)) break;
  }
  return { messages: [...seen.values()].filter((m) => m.sentNs > cursor.floor), snapshotNs: cursor.snapshotNs };
}

export async function scanSyncGroups<G extends { id: string }, S extends { snapshotNs: number | null }>(
  groups: readonly G[], target: string, scan: (group: G, floorNs: number) => Promise<S>,
): Promise<S[]> {
  const ordered = [...groups].sort((a, b) => Number(b.id === target) - Number(a.id === target) || a.id.localeCompare(b.id));
  const scans: S[] = [];
  let floorNs = 0;
  for (const group of ordered) {
    const result = await scan(group, floorNs);
    if (result.snapshotNs !== null) floorNs = Math.max(floorNs, result.snapshotNs - SNAPSHOT_OVERLAP_NS);
    scans.push(result);
  }
  return scans;
}

export function changesSince(messages: readonly SyncMessage[], sinceNs: number): number {
  return messages.filter((m) => m.sentNs > sinceNs && isSyncStateType(m.contentTypeId)
    && !isSyncSnapshotType(m.contentTypeId)).length;
}

const changeCounterSchema = z.object({ count: z.number().int().nonnegative(), ns: z.number().nonnegative() });

export type ChangeCounter = z.infer<typeof changeCounterSchema>;

export function parseChangeCounter(raw: string | null): ChangeCounter | null {
  if (raw === null) return null;
  const parsed = changeCounterSchema.safeParse(parseJson(raw));
  return parsed.success ? parsed.data : null;
}

export interface CountedScan {
  messages: readonly SyncMessage[];
  snapshotNs: number | null;
  cursor: number;
}

export function bootChangeCounter(scan: CountedScan, stored: ChangeCounter | null): ChangeCounter {
  const ns = scan.messages.reduce((max, m) => Math.max(max, m.sentNs), Math.max(scan.cursor, stored?.ns ?? 0));
  if (scan.snapshotNs !== null && scan.snapshotNs > scan.cursor) {
    return { count: changesSince(scan.messages, scan.snapshotNs), ns };
  }
  if (stored === null) {
    return { count: (scan.cursor > 0 ? SNAPSHOT_EVERY : 0) + changesSince(scan.messages, scan.cursor), ns };
  }
  return { count: stored.count + changesSince(scan.messages, Math.max(scan.cursor, stored.ns)), ns };
}

export function countSyncChange(counter: ChangeCounter, m: SyncMessage): ChangeCounter {
  if (m.sentNs <= counter.ns || !isSyncStateType(m.contentTypeId)) return counter;
  if (!isSyncSnapshotType(m.contentTypeId)) return { count: counter.count + 1, ns: m.sentNs };
  return { count: parseSyncSnapshot(m.content) === null ? counter.count : 0, ns: m.sentNs };
}

export interface PinStamp {
  convId: string;
  at: number;
}

export interface SnapshotInputs {
  rows: readonly CachedChannelRow[];
  stored: ReadonlyMap<string, SnapshotRead>;
  seen: ReadonlySet<string>;
  pinOrder: readonly string[];
  pinStamp: PinStamp | null;
  boardOrder: readonly string[];
  boardAt: number | undefined;
  cleared: ClearedChats;
  at: number;
}

function rowRead(row: CachedChannelRow): SnapshotRead | null {
  const markedUnread = row.markedUnread === true;
  return row.lastReadNs > 0 || markedUnread ? { lastReadNs: row.lastReadNs, markedUnread, at: UNSTAMPED_AT } : null;
}

function snapshotReads(inputs: SnapshotInputs): Record<string, SnapshotRead> {
  const reads: Record<string, SnapshotRead> = {};
  for (const row of inputs.rows) {
    const read = inputs.stored.get(row.convId) ?? rowRead(row);
    if (read !== null) reads[row.convId] = read;
  }
  for (const convId of inputs.seen) {
    const read = inputs.stored.get(convId);
    if (read !== undefined) reads[convId] = read;
  }
  return reads;
}

function snapshotPins(order: readonly string[], stamp: PinStamp | null): SyncSnapshotContent['pins'] {
  const first = order[0];
  const at = stamp?.at ?? UNSTAMPED_AT;
  if (first !== undefined) return { convId: first, pinned: true, order: [...order], at };
  return stamp === null ? null : { convId: stamp.convId, pinned: false, order: [], at };
}

export function assembleSyncSnapshot(inputs: SnapshotInputs): SyncSnapshotContent {
  const board = inputs.boardOrder.length === 0 ? null : { order: [...inputs.boardOrder], at: inputs.boardAt ?? UNSTAMPED_AT };
  return {
    reads: snapshotReads(inputs),
    pins: snapshotPins(inputs.pinOrder, inputs.pinStamp),
    cleared: inputs.cleared,
    board,
    at: inputs.at,
  };
}
