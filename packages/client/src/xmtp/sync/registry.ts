import type { JsonCodec } from '../jsonCodec';
import type { OutputSchema } from '../../validate';
import type { SyncMessage } from './kind';
import { READ_SYNC } from './read';
import { PIN_SYNC } from './pin';
import { CLEAR_SYNC } from './clear';
import { BOARD_SYNC, CATEGORY_ORDER_SYNC } from './order';
import { SEARCH_SYNC } from './search';
import { HOME_VIEW_SYNC } from './homeView';
import { DASHBOARD_SYNC } from './dashboard';
import { DEVELOPER_MODE_SYNC } from './developerMode';

export const SYNC_KINDS = {
  read: READ_SYNC,
  pin: PIN_SYNC,
  clear: CLEAR_SYNC,
  board: BOARD_SYNC,
  categoryOrder: CATEGORY_ORDER_SYNC,
  search: SEARCH_SYNC,
  homeView: HOME_VIEW_SYNC,
  dashboard: DASHBOARD_SYNC,
  developerMode: DEVELOPER_MODE_SYNC,
};

type Kinds = typeof SYNC_KINDS;

export type SyncKind = keyof Kinds;

export type SyncContents = { [K in SyncKind]: Kinds[K] extends JsonCodec<infer T> ? T : never };

export type SyncReplay = { [K in SyncKind]: ReturnType<Kinds[K]['collect']> };

export const SYNC_KIND_NAMES = Object.keys(SYNC_KINDS) as readonly SyncKind[];

export function isSyncType(contentTypeId: string | undefined, kind?: SyncKind): boolean {
  if (kind !== undefined) return SYNC_KINDS[kind].matches(contentTypeId);
  return SYNC_KIND_NAMES.some((name) => SYNC_KINDS[name].matches(contentTypeId));
}

export interface SyncCodec<T> extends JsonCodec<T> {
  schema: OutputSchema<T>;
}

const CODECS: { readonly [K in SyncKind]: SyncCodec<SyncContents[K]> } = SYNC_KINDS;

export function syncCodecOf<K extends SyncKind>(kind: K): SyncCodec<SyncContents[K]> {
  return CODECS[kind];
}

export interface SyncTrust {
  inboxId: string;
  nowMs: number;
}

const SYNC_MAX_AHEAD_MS = 86_400_000;

export function collectSyncReplay(messages: readonly SyncMessage[], afterNs: number, trust: SyncTrust): SyncReplay {
  const fresh = messages.filter((m) => m.sentNs > afterNs && trust.inboxId !== '' && m.senderInboxId === trust.inboxId);
  const maxAt = trust.nowMs + SYNC_MAX_AHEAD_MS;
  const replay: Partial<Record<SyncKind, unknown>> = {};
  for (const name of SYNC_KIND_NAMES) replay[name] = SYNC_KINDS[name].collect(fresh, maxAt);
  return replay as SyncReplay;
}
