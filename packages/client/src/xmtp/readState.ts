import { z } from 'zod';
import type { XmtpContentTypeId } from './codecs';
import { frameSourceSchema } from './frame.schema';
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

export const hiddenChannelsSchema = z.record(z.string().min(1), z.object({ hidden: z.boolean(), at: z.number().nonnegative() }));
export type HiddenChannels = z.infer<typeof hiddenChannelsSchema>;

const clearStateSchema = z.object({
  cleared: z.record(z.string().min(1), z.number().nonnegative()),
  hidden: hiddenChannelsSchema.optional().catch(undefined),
});

export function mergeHiddenChannels(local: HiddenChannels, incoming: HiddenChannels): HiddenChannels {
  const merged = { ...local };
  for (const [id, state] of Object.entries(incoming)) {
    const previous = merged[id];
    if (!previous || state.at > previous.at || (state.at === previous.at && state.hidden)) merged[id] = state;
  }
  return merged;
}

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

export const GROUP_KEYS = ['assignee', 'category', 'label', 'status'] as const;

export type GroupKey = (typeof GROUP_KEYS)[number];

export const homeSortSchema = z.object({
  by: z.enum(['status', 'created', 'updated', 'priority']),
  direction: z.enum(['asc', 'desc']),
});

export type HomeSort = z.infer<typeof homeSortSchema>;

export const homeViewSchema = z.object({
  view: z.enum(['chats', 'board']),
  groupBy: z.enum(['none', ...GROUP_KEYS]),
  columnBy: z.enum(GROUP_KEYS).default('status'),
  chatsSort: homeSortSchema.optional(),
  boardSort: homeSortSchema.optional(),
  at: z.number().nonnegative(),
});

export type HomeViewContent = z.infer<typeof homeViewSchema>;

export type HomeViewEdit = Partial<Omit<HomeViewContent, 'at'>>;

export const DEFAULT_HOME_VIEW: HomeViewContent = { view: 'chats', groupBy: 'none', columnBy: 'status', at: 0 };

export const DASHBOARD_WIDTHS = ['full', 'half', 'quarter'] as const;

export type DashboardWidth = (typeof DASHBOARD_WIDTHS)[number];

export const DASHBOARD_HEIGHTS = [1, 2, 3, 4] as const;

export type DashboardHeight = (typeof DASHBOARD_HEIGHTS)[number];

export const DASHBOARD_MAX_WIDGETS = 48;

const DASHBOARD_KEPT_WIDGETS = 256;

const dashboardWidgetSchema = z.object({
  id: z.string().min(1).max(64),
  w: z.string().min(1).max(32),
  h: z.number().int().positive().max(64),
}).passthrough();

export type DashboardWidget = z.infer<typeof dashboardWidgetSchema>;

export const DASHBOARD_FRAME_KIND = 'frame';

const dashboardSourceSchema = z.object({
  conversationId: z.string().min(1).max(128),
  messageId: z.string().min(1).max(128),
});

export type DashboardSource = z.infer<typeof dashboardSourceSchema>;

export function frameSourceOf(widget: DashboardWidget): DashboardSource | null {
  if (widget.kind !== DASHBOARD_FRAME_KIND) return null;
  const parsed = dashboardSourceSchema.safeParse(widget.source);
  return parsed.success ? parsed.data : null;
}

export const DASHBOARD_LIVE_KIND = 'live';

const liveWidgetSchema = z.object({
  source: frameSourceSchema,
  key: z.string().regex(/^[0-9a-f]{64}$/),
  origin: dashboardSourceSchema.optional().catch(undefined),
});

export interface LiveSource { url: string; key: string; origin?: DashboardSource }

export function liveSourceOf(widget: DashboardWidget): LiveSource | null {
  if (widget.kind !== DASHBOARD_LIVE_KIND) return null;
  const parsed = liveWidgetSchema.safeParse(widget);
  if (!parsed.success) return null;
  const { source, key, origin } = parsed.data;
  return origin === undefined ? { url: source.url, key } : { url: source.url, key, origin };
}

function validWidgets(items: readonly unknown[]): DashboardWidget[] {
  const ids = new Set<string>();
  const widgets: DashboardWidget[] = [];
  for (const item of items) {
    const parsed = dashboardWidgetSchema.safeParse(item);
    if (!parsed.success || ids.has(parsed.data.id) || widgets.length === DASHBOARD_KEPT_WIDGETS) continue;
    ids.add(parsed.data.id);
    widgets.push(parsed.data);
  }
  return widgets;
}

export const dashboardSchema = z.object({
  widgets: z.array(z.unknown()).transform(validWidgets),
  at: z.number().nonnegative(),
}).passthrough();

export type DashboardContent = z.infer<typeof dashboardSchema>;

export const EMPTY_DASHBOARD: DashboardContent = { widgets: [], at: 0 };

export interface SyncContents {
  read: ReadStateContent;
  pin: PinStateContent;
  clear: z.infer<typeof clearStateSchema>;
  board: BoardStateContent;
  categoryOrder: BoardStateContent;
  search: SearchStateContent;
  homeView: HomeViewContent;
  dashboard: DashboardContent;
}

export type SyncKind = keyof SyncContents;

export type LatestKind = 'board' | 'categoryOrder' | 'search' | 'homeView' | 'dashboard';

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
  dashboard: syncType('dashboardLayout', dashboardSchema, 'Stage dashboard'),
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

export interface SyncOwner {
  address: string;
  inboxId: string;
}

export interface SyncGroupFacts extends SyncGroupState {
  name: string | undefined;
  addedByInboxId: string | undefined;
  memberInboxIds: readonly string[];
}

export function isOwnSyncGroup(group: SyncGroupFacts, owner: SyncOwner): boolean {
  if (owner.inboxId === '' || group.name !== syncGroupName(owner.address)) return false;
  if (group.addedByInboxId !== owner.inboxId) return false;
  if (group.active && group.memberInboxIds.length === 0) return false;
  return group.memberInboxIds.every((id) => id === owner.inboxId);
}

export function pickPublishGroup<T extends SyncGroupState>(groups: readonly T[]): T | null {
  const active = groups.filter((g) => g.active).sort((a, b) => a.id.localeCompare(b.id));
  return active[0] ?? null;
}

export interface SyncMessage {
  contentTypeId: string | undefined;
  content: unknown;
  senderInboxId: string;
  sentNs: number;
}

export interface SyncTrust {
  inboxId: string;
  nowMs: number;
}

const SYNC_MAX_AHEAD_MS = 86_400_000;

export interface SyncReplay {
  reads: ReadStateContent[];
  pins: PinStateContent[];
  cleared: ClearedChats | null;
  hidden: HiddenChannels | null;
  latest: { [K in LatestKind]: SyncContents[K] | null };
  latestNs: number;
}

function stateOf<K extends SyncKind>(kind: K, m: SyncMessage): SyncContents[K] | null {
  return isSyncType(m.contentTypeId, kind) ? parseSyncState(kind, m.content) : null;
}

function inTime<T extends { at: number }>(state: T | null, maxAt: number): T | null {
  return state !== null && state.at <= maxAt ? state : null;
}

function latestReads(messages: readonly SyncMessage[], maxAt: number): ReadStateContent[] {
  const byConv = new Map<string, ReadStateContent>();
  for (const m of messages) {
    const state = inTime(stateOf('read', m), maxAt);
    const current = state === null ? undefined : byConv.get(state.convId);
    if (state !== null && (current === undefined || state.at > current.at)) byConv.set(state.convId, state);
  }
  return [...byConv.values()];
}

function pinsSinceLastOrder(messages: readonly SyncMessage[], maxAt: number): PinStateContent[] {
  const pins = messages
    .map((m) => inTime(stateOf('pin', m), maxAt))
    .filter((p): p is PinStateContent => p !== null)
    .sort((a, b) => a.at - b.at);
  const lastOrder = pins.map((p) => p.order !== undefined).lastIndexOf(true);
  return lastOrder === -1 ? pins : pins.slice(lastOrder);
}

function clearedUpTo(cleared: ClearedChats, maxAt: number): ClearedChats {
  return Object.fromEntries(Object.entries(cleared).filter(([, at]) => at <= maxAt));
}

function mergedCleared(messages: readonly SyncMessage[], maxAt: number): ClearedChats | null {
  let merged: ClearedChats | null = null;
  for (const m of messages) {
    const state = stateOf('clear', m);
    if (state !== null) merged = mergeClearedChats(merged ?? {}, clearedUpTo(state.cleared, maxAt));
  }
  return merged;
}

function mergedHidden(messages: readonly SyncMessage[], maxAt: number): HiddenChannels | null {
  let merged: HiddenChannels | null = null;
  for (const m of messages) {
    const hidden = stateOf('clear', m)?.hidden;
    if (hidden !== undefined) {
      const valid = Object.fromEntries(Object.entries(hidden).filter(([, state]) => state.at <= maxAt));
      merged = mergeHiddenChannels(merged ?? {}, valid);
    }
  }
  return merged;
}

function latestState<K extends LatestKind>(messages: readonly SyncMessage[], kind: K, maxAt: number): SyncContents[K] | null {
  let latest: SyncContents[K] | null = null;
  for (const m of messages) {
    const state = inTime(stateOf(kind, m), maxAt);
    if (state !== null && (latest === null || state.at > latest.at)) latest = state;
  }
  return latest;
}

function latestHomeView(messages: readonly SyncMessage[], maxAt: number): HomeViewContent | null {
  const states = messages.map(m => inTime(stateOf('homeView', m), maxAt))
    .filter((state): state is HomeViewContent => state !== null)
    .sort((a, b) => b.at - a.at);
  return states.reduce<HomeViewContent | null>((latest, state) => ({ ...state, ...latest }), null);
}

export function collectSyncReplay(messages: readonly SyncMessage[], afterNs: number, trust: SyncTrust): SyncReplay {
  const fresh = messages.filter((m) => m.sentNs > afterNs && trust.inboxId !== '' && m.senderInboxId === trust.inboxId);
  const maxAt = trust.nowMs + SYNC_MAX_AHEAD_MS;
  return {
    reads: latestReads(fresh, maxAt),
    pins: pinsSinceLastOrder(fresh, maxAt),
    cleared: mergedCleared(fresh, maxAt),
    hidden: mergedHidden(fresh, maxAt),
    latest: {
      board: latestState(fresh, 'board', maxAt),
      categoryOrder: latestState(fresh, 'categoryOrder', maxAt),
      search: latestState(fresh, 'search', maxAt),
      homeView: latestHomeView(fresh, maxAt),
      dashboard: latestState(fresh, 'dashboard', maxAt),
    },
    latestNs: fresh.reduce((max, m) => Math.max(max, m.sentNs), afterNs),
  };
}
