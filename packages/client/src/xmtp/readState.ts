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

export const CATEGORY_ORDER_CONTENT_TYPE: XmtpContentTypeId = {
  authorityId: 'stage.box', typeId: 'categoryOrderState', versionMajor: 1, versionMinor: 0,
};

export type CategoryOrderContent = z.infer<typeof boardStateSchema>;

export function categoryOrderFallbackText(): string {
  return 'Stage category order';
}

export function isCategoryOrderType(contentTypeId: string | undefined): boolean {
  return typeof contentTypeId === 'string' && contentTypeId.includes(CATEGORY_ORDER_CONTENT_TYPE.typeId);
}

export function parseCategoryOrder(content: unknown): CategoryOrderContent | null {
  const parsed = boardStateSchema.safeParse(content);
  return parsed.success ? parsed.data : null;
}

export const SEARCH_STATE_CONTENT_TYPE: XmtpContentTypeId = {
  authorityId: 'stage.box', typeId: 'searchState', versionMajor: 1, versionMinor: 0,
};

export const searchStateSchema = z.object({
  query: z.string(),
  labels: z.array(z.string().min(1)),
  unreadOnly: z.boolean(),
  at: z.number().positive(),
});

export type SearchStateContent = z.infer<typeof searchStateSchema>;

export function searchStateFallbackText(): string {
  return 'Stage search';
}

export function isSearchStateType(contentTypeId: string | undefined): boolean {
  return typeof contentTypeId === 'string' && contentTypeId.includes(SEARCH_STATE_CONTENT_TYPE.typeId);
}

export function parseSearchState(content: unknown): SearchStateContent | null {
  const parsed = searchStateSchema.safeParse(content);
  return parsed.success ? parsed.data : null;
}

export const HOME_VIEW_CONTENT_TYPE: XmtpContentTypeId = {
  authorityId: 'stage.box', typeId: 'homeView', versionMajor: 1, versionMinor: 0,
};

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

export function homeViewFallbackText(): string {
  return 'Stage home view';
}

export function isHomeViewType(contentTypeId: string | undefined): boolean {
  return typeof contentTypeId === 'string' && contentTypeId.includes(HOME_VIEW_CONTENT_TYPE.typeId);
}

export function parseHomeView(content: unknown): HomeViewContent | null {
  const parsed = homeViewSchema.safeParse(content);
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
  board: BoardStateContent | null;
  categoryOrder: CategoryOrderContent | null;
  search: SearchStateContent | null;
  homeView: HomeViewContent | null;
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

function latestState<T extends { at: number }>(
  messages: readonly SyncMessage[], isType: (contentTypeId: string | undefined) => boolean, parse: (content: unknown) => T | null,
): T | null {
  let latest: T | null = null;
  for (const m of messages) {
    const state = isType(m.contentTypeId) ? parse(m.content) : null;
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
    board: latestState(fresh, isBoardStateType, parseBoardState),
    categoryOrder: latestState(fresh, isCategoryOrderType, parseCategoryOrder),
    search: latestState(fresh, isSearchStateType, parseSearchState),
    homeView: latestState(fresh, isHomeViewType, parseHomeView),
    latestNs: fresh.reduce((max, m) => Math.max(max, m.sentNs), afterNs),
  };
}
