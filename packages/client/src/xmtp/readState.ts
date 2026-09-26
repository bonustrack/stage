import { z } from 'zod';
import type { XmtpContentTypeId } from './codecs';
import { labelEntriesSchema, mergeLabelEntries, type LabelEntry } from './labelRegistry';

export const READ_STATE_CONTENT_TYPE: XmtpContentTypeId = {
  authorityId: 'stage.box', typeId: 'readState', versionMajor: 1, versionMinor: 0,
};

export const readStateSchema = z.object({
  convId: z.string().min(1),
  lastReadNs: z.number().nonnegative(),
  markedUnread: z.boolean(),
  at: z.number().positive(),
});

export type ReadStateContent = z.infer<typeof readStateSchema>;

export function readStateFallbackText(): string {
  return 'Stage read state';
}

export function isReadStateType(contentTypeId: string | undefined): boolean {
  return typeof contentTypeId === 'string' && contentTypeId.includes(READ_STATE_CONTENT_TYPE.typeId);
}

export function parseReadState(content: unknown): ReadStateContent | null {
  const parsed = readStateSchema.safeParse(content);
  return parsed.success ? parsed.data : null;
}

export const PIN_STATE_CONTENT_TYPE: XmtpContentTypeId = {
  authorityId: 'stage.box', typeId: 'pinState', versionMajor: 1, versionMinor: 0,
};

export const pinStateSchema = z.object({
  convId: z.string().min(1),
  pinned: z.boolean(),
  at: z.number().positive(),
  order: z.array(z.string().min(1)).optional(),
});

export type PinStateContent = z.infer<typeof pinStateSchema>;

export function pinStateFallbackText(): string {
  return 'Stage pin state';
}

export function isPinStateType(contentTypeId: string | undefined): boolean {
  return typeof contentTypeId === 'string' && contentTypeId.includes(PIN_STATE_CONTENT_TYPE.typeId);
}

export function parsePinState(content: unknown): PinStateContent | null {
  const parsed = pinStateSchema.safeParse(content);
  return parsed.success ? parsed.data : null;
}

export const CLEAR_STATE_CONTENT_TYPE: XmtpContentTypeId = {
  authorityId: 'stage.box', typeId: 'clearState', versionMajor: 1, versionMinor: 0,
};

export type ClearedChats = Record<string, number>;

export const clearStateSchema = z.object({
  cleared: z.record(z.string().min(1), z.number().nonnegative()),
});

export type ClearStateContent = z.infer<typeof clearStateSchema>;

export function clearStateFallbackText(): string {
  return 'Stage deleted chats';
}

export function isClearStateType(contentTypeId: string | undefined): boolean {
  return typeof contentTypeId === 'string' && contentTypeId.includes(CLEAR_STATE_CONTENT_TYPE.typeId);
}

export function parseClearState(content: unknown): ClearStateContent | null {
  const parsed = clearStateSchema.safeParse(content);
  return parsed.success ? parsed.data : null;
}

export const BOARD_STATE_CONTENT_TYPE: XmtpContentTypeId = {
  authorityId: 'stage.box', typeId: 'boardState', versionMajor: 1, versionMinor: 0,
};

export const boardOrderSchema = z.array(z.string().min(1));

export const boardStateSchema = z.object({
  order: boardOrderSchema,
  at: z.number().positive(),
});

export type BoardStateContent = z.infer<typeof boardStateSchema>;

export function boardStateFallbackText(): string {
  return 'Stage board layout';
}

export function isBoardStateType(contentTypeId: string | undefined): boolean {
  return typeof contentTypeId === 'string' && contentTypeId.includes(BOARD_STATE_CONTENT_TYPE.typeId);
}

export function parseBoardState(content: unknown): BoardStateContent | null {
  const parsed = boardStateSchema.safeParse(content);
  return parsed.success ? parsed.data : null;
}

export const LABEL_STATE_CONTENT_TYPE: XmtpContentTypeId = {
  authorityId: 'stage.box', typeId: 'labelState', versionMajor: 1, versionMinor: 0,
};

export const labelStateSchema = z.object({
  labels: labelEntriesSchema,
});

export type LabelStateContent = z.infer<typeof labelStateSchema>;

export function labelStateFallbackText(): string {
  return 'Stage board labels';
}

export function isLabelStateType(contentTypeId: string | undefined): boolean {
  return typeof contentTypeId === 'string' && contentTypeId.includes(LABEL_STATE_CONTENT_TYPE.typeId);
}

export function parseLabelState(content: unknown): LabelStateContent | null {
  const parsed = labelStateSchema.safeParse(content);
  return parsed.success ? parsed.data : null;
}

export function mergeClearedChats(local: ClearedChats, incoming: ClearedChats): ClearedChats {
  const merged: ClearedChats = {};
  for (const [peer, at] of [...Object.entries(local), ...Object.entries(incoming)]) {
    const key = peer.toLowerCase();
    merged[key] = Math.max(merged[key] ?? 0, at);
  }
  return merged;
}

const SILENT_TYPE_IDS: readonly string[] = ['reaction', 'readReceipt'];

export function revivesClearedChat(typeId: string | undefined): boolean {
  return typeId === undefined || !SILENT_TYPE_IDS.includes(typeId);
}

export function isChatCleared(cleared: ClearedChats, peerAddress: string | null | undefined, lastTsMs: number | null): boolean {
  if (!peerAddress) return false;
  const clearedAt = cleared[peerAddress.toLowerCase()];
  return clearedAt !== undefined && (lastTsMs ?? 0) <= clearedAt;
}

export interface ClearableRow {
  peerAddress: string | null;
  lastTs: number | null;
  lastBubbleTs?: number | null;
}

export function isRowCleared(cleared: ClearedChats, row: ClearableRow): boolean {
  const revivalTs = row.lastBubbleTs === undefined ? row.lastTs : row.lastBubbleTs;
  return isChatCleared(cleared, row.peerAddress, revivalTs);
}

const SYNC_GROUP_PREFIX = 'stage.sync:';

export function syncGroupName(address: string): string {
  return `${SYNC_GROUP_PREFIX}${address.toLowerCase()}`;
}

export function isSyncGroupName(name: unknown): boolean {
  return typeof name === 'string' && name.startsWith(SYNC_GROUP_PREFIX);
}

export interface SyncGroupCandidate {
  id: string;
  createdAtNs: number;
}

export function pickSyncGroup<T extends SyncGroupCandidate>(groups: readonly T[]): T | null {
  const sorted = [...groups].sort((a, b) => a.createdAtNs - b.createdAtNs || a.id.localeCompare(b.id));
  return sorted[0] ?? null;
}

export function shouldApplyReadState(localAt: number | undefined, incomingAt: number): boolean {
  return localAt === undefined || incomingAt > localAt;
}

export interface SyncGroupState extends SyncGroupCandidate {
  active: boolean;
}

export function pickPublishGroup<T extends SyncGroupState>(groups: readonly T[]): T | null {
  const active = groups.filter((g) => g.active).sort((a, b) => a.id.localeCompare(b.id));
  return active[0] ?? null;
}

export interface SyncMessage {
  contentTypeId: string | undefined;
  content: unknown;
  sentNs: number;
}

export interface SyncReplay {
  reads: ReadStateContent[];
  pins: PinStateContent[];
  cleared: ClearedChats | null;
  board: BoardStateContent | null;
  labels: LabelEntry[] | null;
  latestNs: number;
}

function latestReads(messages: readonly SyncMessage[]): ReadStateContent[] {
  const byConv = new Map<string, ReadStateContent>();
  for (const m of messages) {
    const state = isReadStateType(m.contentTypeId) ? parseReadState(m.content) : null;
    const current = state === null ? undefined : byConv.get(state.convId);
    if (state !== null && (current === undefined || state.at > current.at)) byConv.set(state.convId, state);
  }
  return [...byConv.values()];
}

function pinsSinceLastOrder(messages: readonly SyncMessage[]): PinStateContent[] {
  const pins = messages
    .map((m) => (isPinStateType(m.contentTypeId) ? parsePinState(m.content) : null))
    .filter((p): p is PinStateContent => p !== null)
    .sort((a, b) => a.at - b.at);
  const lastOrder = pins.map((p) => p.order !== undefined).lastIndexOf(true);
  return lastOrder === -1 ? pins : pins.slice(lastOrder);
}

function mergedCleared(messages: readonly SyncMessage[]): ClearedChats | null {
  let merged: ClearedChats | null = null;
  for (const m of messages) {
    const state = isClearStateType(m.contentTypeId) ? parseClearState(m.content) : null;
    if (state !== null) merged = mergeClearedChats(merged ?? {}, state.cleared);
  }
  return merged;
}

function latestBoard(messages: readonly SyncMessage[]): BoardStateContent | null {
  let latest: BoardStateContent | null = null;
  for (const m of messages) {
    const state = isBoardStateType(m.contentTypeId) ? parseBoardState(m.content) : null;
    if (state !== null && (latest === null || state.at > latest.at)) latest = state;
  }
  return latest;
}

function mergedLabels(messages: readonly SyncMessage[]): LabelEntry[] | null {
  let merged: LabelEntry[] | null = null;
  for (const m of messages) {
    const state = isLabelStateType(m.contentTypeId) ? parseLabelState(m.content) : null;
    if (state !== null) merged = mergeLabelEntries(merged ?? [], state.labels);
  }
  return merged;
}

export function collectSyncReplay(messages: readonly SyncMessage[], afterNs: number): SyncReplay {
  const fresh = messages.filter((m) => m.sentNs > afterNs);
  return {
    reads: latestReads(fresh),
    pins: pinsSinceLastOrder(fresh),
    cleared: mergedCleared(fresh),
    board: latestBoard(fresh),
    labels: mergedLabels(fresh),
    latestNs: fresh.reduce((max, m) => Math.max(max, m.sentNs), afterNs),
  };
}
