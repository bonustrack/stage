import { secureStorage } from '../platform/storage';
import { PersistentStore, getSecure, setSecure } from './cache.shared';
import { makeListeners } from './storeCore';
import { applyRead, applyUnread, applySentPatch, normalizeChannelRowTitle } from '@stage-labs/client/xmtp/channelsCache';
import { attempt, ignored } from './errorPolicy';
import type { XmtpConsent } from './xmtp.types';
import { visibleCachedRows } from './sync/hiddenChannels';
import { knownActiveAccountId, subscribeActiveAccountId } from './accountSelection';
import { cachedRowsOf, type CachedRow } from './cachedRows.model';

export interface ReadStateChange {
  convId: string;
  lastReadNs: number;
  markedUnread: boolean;
}

const readChanges = makeListeners<ReadStateChange>();
export const onReadStateChanged = readChanges.subscribe;

const stores = new Map<string, PersistentStore<CachedRow[]>>();

const DEFAULT_KEY = '__default__';
let activeId: string = knownActiveAccountId() ?? DEFAULT_KEY;

const activeListeners = makeListeners<CachedRow[] | null>();
let activeStoreUnsub: (() => void) | null = null;

let notifyScheduled = false;
function notifyActive(): void {
  if (notifyScheduled) return;
  notifyScheduled = true;
  queueMicrotask(() => {
    notifyScheduled = false;
    activeListeners.notify(activeStore().get());
  });
}

function fileNameFor(id: string): string {
  const safe = id.replace(/[^A-Za-z0-9._-]/g, '_');
  return `channels-cache.${safe}.json`;
}

function storeFor(id: string): PersistentStore<CachedRow[]> {
  let s = stores.get(id);
  if (!s) {
    s = new PersistentStore<CachedRow[]>(fileNameFor(id), {
      parse: cachedRowsOf,
      restore: async (rows) => (await visibleCachedRows(id, rows)).map(normalizeChannelRowTitle),
    });
    stores.set(id, s);
  }
  return s;
}

function activeStore(): PersistentStore<CachedRow[]> {
  return storeFor(activeId);
}

function bindActiveStore(): void {
  if (activeStoreUnsub) {
    attempt(activeStoreUnsub, 'cleanup');
    activeStoreUnsub = null;
  }
  activeStoreUnsub = activeStore().subscribe(() => {
    notifyActive();
  });
}
bindActiveStore();

function followActiveAccount(): void {
  const next = knownActiveAccountId() ?? DEFAULT_KEY;
  if (next === activeId) return;
  activeId = next;
  bindActiveStore();
  notifyActive();
  void activeStore().hydrate();
}
subscribeActiveAccountId(followActiveAccount);

export async function hydrateCachedRows(): Promise<CachedRow[] | null> {
  if (activeId === DEFAULT_KEY) return null;
  return activeStore().hydrate();
}

export function getCachedRows(): CachedRow[] | null {
  return activeStore().get();
}
export function setCachedRows(next: CachedRow[] | null): void {
  activeStore().set(next?.map(normalizeChannelRowTitle) ?? null);
}
export const subscribeCachedRows = activeListeners.subscribe;

const LAST_READ_PREFIX = 'unread.lastRead.';
function lastReadOf(raw: string | null): number {
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}
export async function getLastReadNs(convId: string): Promise<number> {
  return lastReadOf(await getSecure(LAST_READ_PREFIX + convId));
}
async function setLastReadNs(convId: string, ns: number): Promise<void> {
  await setSecure(LAST_READ_PREFIX + convId, String(ns));
}
export async function raiseLastReadNs(convId: string, ns: number): Promise<void> {
  const stored = lastReadOf(await secureStorage.get(LAST_READ_PREFIX + convId));
  await setLastReadNs(convId, Math.max(stored, ns));
}

const MARKED_UNREAD_PREFIX = 'unread.marked.';
export async function getMarkedUnread(convId: string): Promise<boolean> {
  return (await getSecure(MARKED_UNREAD_PREFIX + convId)) === '1';
}
export async function setMarkedUnreadFlag(convId: string, value: boolean): Promise<void> {
  if (value) await setSecure(MARKED_UNREAD_PREFIX + convId, '1');
  else await clearMarkedUnread(convId);
}

async function clearMarkedUnread(convId: string): Promise<void> {
  await secureStorage.delete(MARKED_UNREAD_PREFIX + convId).catch(ignored(undefined, 'cleanup'));
}

export async function markConvRead(convId: string): Promise<void> {
  const nowNs = Date.now() * 1_000_000;
  await setLastReadNs(convId, Date.now() * 1_000_000);
  await clearMarkedUnread(convId);
  readChanges.notify({ convId, lastReadNs: nowNs, markedUnread: false });
  const rows = getCachedRows();
  const next = rows ? applyRead(rows, convId, nowNs) : null;
  if (next !== null) setCachedRows(next);
}

export async function markConvUnread(convId: string): Promise<void> {
  await setSecure(MARKED_UNREAD_PREFIX + convId, '1');
  const rows = getCachedRows();
  const current = rows?.find((r) => r.convId === convId);
  readChanges.notify({ convId, lastReadNs: current?.lastReadNs ?? 0, markedUnread: true });
  const next = rows ? applyUnread(rows, convId) : null;
  if (next !== null) setCachedRows(next);
}

export function patchRowSent(convId: string, preview: string): void {
  const rows = getCachedRows();
  if (!rows) return;
  if (rows.some((r) => r.convId === convId && r.markedUnread)) void markConvRead(convId);
  const next = applySentPatch(rows, convId, preview, Date.now());
  if (next !== null) setCachedRows(next);
}

export function patchRowConsent(convId: string, consent: XmtpConsent): void {
  const rows = getCachedRows();
  const current = rows?.find((r) => r.convId === convId);
  if (!rows || !current || current.consent === consent) return;
  setCachedRows(rows.map((r) => (r === current ? { ...r, consent } : r)));
}
