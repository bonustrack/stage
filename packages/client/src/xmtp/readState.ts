import { z, type ZodType } from 'zod';
import type { XmtpContentTypeId } from './codecs';

export const READ_STATE_CONTENT_TYPE: XmtpContentTypeId = {
  authorityId: 'stage.box', typeId: 'readState', versionMajor: 1, versionMinor: 0,
};

export interface ReadStateContent {
  convId: string;
  lastReadNs: number;
  markedUnread: boolean;
  at: number;
}

export const readStateSchema: ZodType<ReadStateContent> = z.object({
  convId: z.string().min(1),
  lastReadNs: z.number().nonnegative(),
  markedUnread: z.boolean(),
  at: z.number().positive(),
});

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

export const SYNC_GROUP_PREFIX = 'stage.sync:';

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
