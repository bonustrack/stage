import { z } from 'zod';
import type { XmtpContentTypeId } from './codecs';
import type { OutputSchema } from '../validate';

const readStateSchema = z.object({
  convId: z.string().min(1),
  lastReadNs: z.number().nonnegative(),
  markedUnread: z.boolean(),
  at: z.number().positive(),
});

export type ReadStateContent = z.infer<typeof readStateSchema>;

const pinStateSchema = z.object({
  convId: z.string().min(1),
  pinned: z.boolean(),
  at: z.number().positive(),
  order: z.array(z.string().min(1)).optional(),
});

export type PinStateContent = z.infer<typeof pinStateSchema>;

export type ClearedChats = Record<string, number>;

const clearStateSchema = z.object({
  cleared: z.record(z.string().min(1), z.number().nonnegative()),
});

export const boardOrderSchema = z.array(z.string().min(1));

const boardStateSchema = z.object({
  order: boardOrderSchema,
  at: z.number().positive(),
});

export type BoardStateContent = z.infer<typeof boardStateSchema>;

export const searchStateSchema = z.object({
  query: z.string(),
  labels: z.array(z.string().min(1)),
  unreadOnly: z.boolean(),
  at: z.number().nonnegative(),
});

export type SearchStateContent = z.infer<typeof searchStateSchema>;

export const GROUP_KEYS = ['assignee', 'category', 'label'] as const;

export type GroupKey = (typeof GROUP_KEYS)[number];

export const homeViewSchema = z.object({
  view: z.enum(['chats', 'board']),
  groupBy: z.enum(['none', ...GROUP_KEYS]),
  columnBy: z.enum(GROUP_KEYS),
  at: z.number().nonnegative(),
});

export type HomeViewContent = z.infer<typeof homeViewSchema>;

export type HomeViewEdit = Partial<Omit<HomeViewContent, 'at'>>;

export const DEFAULT_HOME_VIEW: HomeViewContent = { view: 'chats', groupBy: 'none', columnBy: 'label', at: 0 };

export interface SyncContents {
  read: ReadStateContent;
  pin: PinStateContent;
  clear: z.infer<typeof clearStateSchema>;
  board: BoardStateContent;
  categoryOrder: BoardStateContent;
  search: SearchStateContent;
  homeView: HomeViewContent;
}

export type SyncKind = keyof SyncContents;

export type LatestKind = 'board' | 'categoryOrder' | 'search' | 'homeView';

interface SyncType<T> {
  contentType: XmtpContentTypeId;
  schema: OutputSchema<T>;
  fallback: string;
}

function syncType<T>(typeId: string, schema: OutputSchema<T>, fallback: string): SyncType<T> {
  return { contentType: { authorityId: 'stage.box', typeId, versionMajor: 1, versionMinor: 0 }, schema, fallback };
}

export const SYNC_TYPES: { [K in SyncKind]: SyncType<SyncContents[K]> } = {
  read: syncType('readState', readStateSchema, 'Stage read state'),
  pin: syncType('pinState', pinStateSchema, 'Stage pin state'),
  clear: syncType('clearState', clearStateSchema, 'Stage deleted chats'),
  board: syncType('boardState', boardStateSchema, 'Stage board layout'),
  categoryOrder: syncType('categoryOrderState', boardStateSchema, 'Stage category order'),
  search: syncType('searchState', searchStateSchema, 'Stage search'),
  homeView: syncType('homeView', homeViewSchema, 'Stage home view'),
};

export function isSyncType(contentTypeId: string | undefined, kind?: SyncKind): boolean {
  if (typeof contentTypeId !== 'string') return false;
  const types = kind === undefined ? Object.values(SYNC_TYPES) : [SYNC_TYPES[kind]];
  return types.some(type => contentTypeId.includes(type.contentType.typeId));
}

export function parseSyncState<K extends SyncKind>(kind: K, content: unknown): SyncContents[K] | null {
  const parsed = SYNC_TYPES[kind].schema.safeParse(content);
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
  latest: { [K in LatestKind]: SyncContents[K] | null };
  latestNs: number;
}

function stateOf<K extends SyncKind>(kind: K, m: SyncMessage): SyncContents[K] | null {
  return isSyncType(m.contentTypeId, kind) ? parseSyncState(kind, m.content) : null;
}

function latestReads(messages: readonly SyncMessage[]): ReadStateContent[] {
  const byConv = new Map<string, ReadStateContent>();
  for (const m of messages) {
    const state = stateOf('read', m);
    const current = state === null ? undefined : byConv.get(state.convId);
    if (state !== null && (current === undefined || state.at > current.at)) byConv.set(state.convId, state);
  }
  return [...byConv.values()];
}

function pinsSinceLastOrder(messages: readonly SyncMessage[]): PinStateContent[] {
  const pins = messages
    .map((m) => stateOf('pin', m))
    .filter((p): p is PinStateContent => p !== null)
    .sort((a, b) => a.at - b.at);
  const lastOrder = pins.map((p) => p.order !== undefined).lastIndexOf(true);
  return lastOrder === -1 ? pins : pins.slice(lastOrder);
}

function mergedCleared(messages: readonly SyncMessage[]): ClearedChats | null {
  let merged: ClearedChats | null = null;
  for (const m of messages) {
    const state = stateOf('clear', m);
    if (state !== null) merged = mergeClearedChats(merged ?? {}, state.cleared);
  }
  return merged;
}

function latestState<K extends LatestKind>(messages: readonly SyncMessage[], kind: K): SyncContents[K] | null {
  let latest: SyncContents[K] | null = null;
  for (const m of messages) {
    const state = stateOf(kind, m);
    if (state !== null && (latest === null || state.at > latest.at)) latest = state;
  }
  return latest;
}

export function collectSyncReplay(messages: readonly SyncMessage[], afterNs: number): SyncReplay {
  const fresh = messages.filter((m) => m.sentNs > afterNs);
  return {
    reads: latestReads(fresh),
    pins: pinsSinceLastOrder(fresh),
    cleared: mergedCleared(fresh),
    latest: {
      board: latestState(fresh, 'board'),
      categoryOrder: latestState(fresh, 'categoryOrder'),
      search: latestState(fresh, 'search'),
      homeView: latestState(fresh, 'homeView'),
    },
    latestNs: fresh.reduce((max, m) => Math.max(max, m.sentNs), afterNs),
  };
}
