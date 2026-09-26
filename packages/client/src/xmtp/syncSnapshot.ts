import { z } from 'zod';
import type { CachedChannelRow } from './channelsCache';
import type { XmtpContentTypeId } from './codecs';
import { labelEntriesSchema, type LabelEntry } from './labelRegistry';
import {
  BOARD_STATE_CONTENT_TYPE, CLEAR_STATE_CONTENT_TYPE, LABEL_STATE_CONTENT_TYPE, PIN_STATE_CONTENT_TYPE,
  READ_STATE_CONTENT_TYPE, boardStateSchema, clearStateSchema, collectSyncReplay, isBoardStateType, isClearStateType,
  isLabelStateType, isPinStateType, isReadStateType, readStateSchema, type ClearedChats, type SyncMessage,
  type SyncReplay,
} from './readState';

export const SYNC_SNAPSHOT_CONTENT_TYPE: XmtpContentTypeId = {
  authorityId: 'stage.box', typeId: 'syncSnapshot', versionMajor: 1, versionMinor: 0,
};

export const UNSTAMPED_AT = 1;

const idSchema = z.string().min(1);
const atSchema = z.number().positive();

const snapshotReadSchema = readStateSchema.omit({ convId: true });

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
  cleared: clearStateSchema.shape.cleared,
  board: boardStateSchema.nullable(),
  labels: labelEntriesSchema,
  groups: z.array(idSchema),
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

const SYNC_STATE_TYPES = [
  isReadStateType, isPinStateType, isClearStateType, isBoardStateType, isLabelStateType, isSyncSnapshotType,
];

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
  const message = (type: XmtpContentTypeId, content: unknown): SyncMessage => ({ contentTypeId: typeString(type), content, sentNs });
  const reads = Object.entries(snapshot.reads).map(([convId, read]) => message(READ_STATE_CONTENT_TYPE, { convId, ...read }));
  const pins = snapshot.pins === null ? [] : [message(PIN_STATE_CONTENT_TYPE, snapshot.pins)];
  const board = snapshot.board === null ? [] : [message(BOARD_STATE_CONTENT_TYPE, snapshot.board)];
  const labels = snapshot.labels.length === 0 ? [] : [message(LABEL_STATE_CONTENT_TYPE, { labels: snapshot.labels })];
  return [...reads, ...pins, message(CLEAR_STATE_CONTENT_TYPE, { cleared: snapshot.cleared }), ...board, ...labels];
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
  covers: ReadonlyMap<string, number>;
  floorNs: number;
  reachedNs: number;
}

function addCovers(covers: Map<string, number>, messages: readonly SyncMessage[]): void {
  for (const m of messages) {
    const snapshot = isSyncSnapshotType(m.contentTypeId) ? parseSyncSnapshot(m.content) : null;
    for (const id of snapshot?.groups ?? []) covers.set(id, Math.max(covers.get(id) ?? 0, m.sentNs));
  }
}

function oldestNs(messages: readonly SyncMessage[]): number {
  return messages.reduce((min, m) => Math.min(min, m.sentNs), Number.POSITIVE_INFINITY);
}

function scanFloor(afterNs: number, snapshotNs: number | undefined): number {
  return snapshotNs === undefined ? afterNs : Math.max(afterNs, snapshotNs - SNAPSHOT_OVERLAP_NS);
}

interface ScanCursor {
  limit: number;
  beforeMs: number | undefined;
  floor: number;
  reached: number;
}

function scanDone(cursor: ScanCursor, seen: number): boolean {
  return cursor.reached <= cursor.floor || seen >= SYNC_SCAN_CAP || cursor.limit > SYNC_SCAN_CAP;
}

function nextCursor(cursor: ScanCursor, page: readonly SyncMessage[], fresh: number): ScanCursor {
  if (fresh === 0) return { ...cursor, limit: cursor.limit * 2 };
  return { ...cursor, beforeMs: Math.floor(oldestNs(page) / 1_000_000) + 1 };
}

export async function scanSyncHistory<M extends SyncPageMessage>(
  fetchPage: FetchSyncPage<M>, afterNs: number, groupId: string,
): Promise<SyncScan<M>> {
  const seen = new Map<string, M>();
  const covers = new Map<string, number>();
  let cursor: ScanCursor = { limit: SYNC_PAGE_SIZE, beforeMs: undefined, floor: afterNs, reached: Number.POSITIVE_INFINITY };
  for (;;) {
    const page = await fetchPage(cursor.limit, cursor.beforeMs);
    const fresh = page.filter((m) => !seen.has(m.id));
    for (const m of fresh) seen.set(m.id, m);
    addCovers(covers, fresh);
    const reached = page.length < cursor.limit ? 0 : Math.min(cursor.reached, oldestNs(page));
    cursor = { ...cursor, floor: scanFloor(afterNs, covers.get(groupId)), reached };
    if (scanDone(cursor, seen.size)) break;
    cursor = nextCursor(cursor, page, fresh.length);
  }
  const { floor, reached } = cursor;
  const messages = [...seen.values()].filter((m) => m.sentNs > floor);
  const kept = new Map<string, number>();
  addCovers(kept, messages);
  return { messages, snapshotNs: covers.get(groupId) ?? null, covers: kept, floorNs: floor, reachedNs: reached };
}

export function scanCovers(scan: Pick<SyncScan<SyncPageMessage>, 'floorNs' | 'reachedNs'>, cursorNs: number): boolean {
  return scan.reachedNs <= Math.max(scan.floorNs, cursorNs);
}

export async function scanSyncGroups<G extends { id: string }, S extends { covers: ReadonlyMap<string, number> }>(
  groups: readonly G[], target: string, scan: (group: G, floorNs: number) => Promise<S>,
): Promise<S[]> {
  const ordered = [...groups].sort((a, b) => Number(b.id === target) - Number(a.id === target) || a.id.localeCompare(b.id));
  const floors = new Map<string, number>();
  const scans: S[] = [];
  for (const group of ordered) {
    const result = await scan(group, floors.get(group.id) ?? 0);
    for (const [id, ns] of result.covers) floors.set(id, Math.max(floors.get(id) ?? 0, ns - SNAPSHOT_OVERLAP_NS));
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

const pinStampSchema = z.object({ convId: idSchema, at: atSchema });

export type PinStamp = z.infer<typeof pinStampSchema>;

const syncStampsSchema = z.object({ pin: pinStampSchema.nullable(), boardAt: atSchema.nullable() });

export type SyncStamps = z.infer<typeof syncStampsSchema>;

export const NO_SYNC_STAMPS: SyncStamps = { pin: null, boardAt: null };

export function parseSyncStamps(raw: string | null): SyncStamps | null {
  if (raw === null) return null;
  const parsed = syncStampsSchema.safeParse(parseJson(raw));
  return parsed.success ? parsed.data : null;
}

function newerStamp(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  return b === null ? a : Math.max(a, b);
}

export function mergeSyncStamps(a: SyncStamps, b: SyncStamps): SyncStamps {
  const pin = a.pin === null || (b.pin !== null && b.pin.at > a.pin.at) ? b.pin : a.pin;
  return { pin, boardAt: newerStamp(a.boardAt, b.boardAt) };
}

export function replayStamps(replay: SyncReplay): SyncStamps {
  const pin = replay.pins.find((p) => p.order !== undefined);
  return { pin: pin === undefined ? null : { convId: pin.convId, at: pin.at }, boardAt: replay.board?.at ?? null };
}

export interface SnapshotInputs {
  rows: readonly CachedChannelRow[];
  stored: ReadonlyMap<string, SnapshotRead>;
  seen: ReadonlySet<string>;
  pinOrder: readonly string[];
  boardOrder: readonly string[];
  labels: readonly LabelEntry[];
  stamps: SyncStamps;
  cleared: ClearedChats;
  groups: readonly string[];
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

function snapshotBoard(order: readonly string[], boardAt: number | null): SyncSnapshotContent['board'] {
  if (boardAt === null && order.length === 0) return null;
  return { order: [...order], at: boardAt ?? UNSTAMPED_AT };
}

export function assembleSyncSnapshot(inputs: SnapshotInputs): SyncSnapshotContent {
  return {
    reads: snapshotReads(inputs),
    pins: snapshotPins(inputs.pinOrder, inputs.stamps.pin),
    cleared: inputs.cleared,
    board: snapshotBoard(inputs.boardOrder, inputs.stamps.boardAt),
    labels: [...inputs.labels],
    groups: [...inputs.groups],
    at: inputs.at,
  };
}
