import { z } from 'zod';
import type { XmtpContentTypeId } from './codecs';

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
