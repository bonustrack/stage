
import { PersistentStore } from './cache';
import { markConvReadSynced, markConvUnreadSynced } from './xmtp';
import {
  applyRead, applyUnread, applySentPatch,
  type CachedChannelRow,
} from '@stage-labs/client/xmtp/channelsCache';

export type CachedRow = CachedChannelRow;

const stores = new Map<string, PersistentStore<CachedRow[]>>();

const DEFAULT_KEY = '__default__';
let activeId: string = DEFAULT_KEY;

const activeListeners = new Set<(rows: CachedRow[] | null) => void>();
let activeStoreUnsub: (() => void) | null = null;

let notifyScheduled = false;
function notifyActive(): void {
  if (notifyScheduled) return;
  notifyScheduled = true;
  queueMicrotask(() => {
    notifyScheduled = false;
    const v = activeStore().get();
    for (const l of activeListeners) l(v);
  });
}

function fileNameFor(id: string): string {
  if (id === DEFAULT_KEY) return 'channels-cache.json';
  const safe = id.replace(/[^A-Za-z0-9._-]/g, '_');
  return `channels-cache.${safe}.json`;
}

function storeFor(id: string): PersistentStore<CachedRow[]> {
  let s = stores.get(id);
  if (!s) { s = new PersistentStore<CachedRow[]>(fileNameFor(id), true); stores.set(id, s); }
  return s;
}

function activeStore(): PersistentStore<CachedRow[]> { return storeFor(activeId); }

export function getActiveAccountIdSync(): string { return activeId; }

function bindActiveStore(): void {
  if (activeStoreUnsub) { try { activeStoreUnsub(); } catch { } activeStoreUnsub = null; }
  activeStoreUnsub = activeStore().subscribe(() => { notifyActive(); });
}
bindActiveStore();

export function setActiveAccountForCache(id: string | null): void {
  const next = id !== null && id !== '' ? id : DEFAULT_KEY;
  if (next === activeId) return;
  activeId = next;
  bindActiveStore();
  const s = activeStore();
  notifyActive();
  void s.hydrate();
}

export async function hydrateCachedRows(): Promise<CachedRow[] | null> {
  const v = await activeStore().hydrate();
  return Array.isArray(v) ? v : null;
}

export function clearCachedRows(): void { activeStore().clear(); }

export function getCachedRows(): CachedRow[] | null { return activeStore().get(); }
export function setCachedRows(next: CachedRow[] | null): void { activeStore().set(next); }
export function subscribeCachedRows(l: (rows: CachedRow[] | null) => void): () => void {
  activeListeners.add(l);
  return () => { activeListeners.delete(l); };
}

function currentRows(): CachedRow[] | null { return activeStore().get(); }

export async function markConvRead(convId: string): Promise<void> {
  const nowNs = Date.now() * 1_000_000;
  await markConvReadSynced(convId);
  const rows = currentRows();
  if (!rows) return;
  const next = applyRead(rows, convId, nowNs);
  if (next === null) return;
  setCachedRows(next);
}

export async function markConvUnread(convId: string): Promise<void> {
  await markConvUnreadSynced(convId);
  const rows = currentRows();
  if (!rows) return;
  const next = applyUnread(rows, convId);
  if (next === null) return;
  setCachedRows(next);
}

export function patchRowSent(convId: string, preview: string): void {
  const rows = currentRows();
  if (!rows) return;
  const next = applySentPatch(rows, convId, preview, Date.now());
  if (next === null) return;
  setCachedRows(next);
}