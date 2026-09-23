
import { PersistentStore } from './cache.shared';
import { markConvReadSynced, markConvUnreadSynced } from './xmtp.client';
import { notifyReadStateChanged } from './readSyncRegistry';
import {
  applyRead, applyUnread, applySentPatch,
  type CachedChannelRow,
} from '@stage-labs/client/xmtp/channelsCache';
import { attempt } from './errorPolicy';

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

export function knownActiveAccountId(): string | null { return activeId === DEFAULT_KEY ? null : activeId; }

function bindActiveStore(): void {
  if (activeStoreUnsub) { attempt(activeStoreUnsub, 'cleanup'); activeStoreUnsub = null; }
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
  if (activeId === DEFAULT_KEY) return null;
  const v = await activeStore().hydrate();
  return Array.isArray(v) ? v : null;
}


export function getCachedRows(): CachedRow[] | null { return activeStore().get(); }
export function setCachedRows(next: CachedRow[] | null): void { activeStore().set(next); }
export function subscribeCachedRows(l: (rows: CachedRow[] | null) => void): () => void {
  activeListeners.add(l);
  return () => { activeListeners.delete(l); };
}

export async function markConvRead(convId: string): Promise<void> {
  const nowNs = Date.now() * 1_000_000;
  await markConvReadSynced(convId);
  notifyReadStateChanged({ convId, lastReadNs: nowNs, markedUnread: false });
  const rows = getCachedRows();
  if (!rows) return;
  const next = applyRead(rows, convId, nowNs);
  if (next === null) return;
  setCachedRows(next);
}

export async function markConvUnread(convId: string): Promise<void> {
  await markConvUnreadSynced(convId);
  const rows = getCachedRows();
  const current = rows?.find((r) => r.convId === convId);
  notifyReadStateChanged({ convId, lastReadNs: current?.lastReadNs ?? 0, markedUnread: true });
  if (!rows) return;
  const next = applyUnread(rows, convId);
  if (next === null) return;
  setCachedRows(next);
}

export function patchRowSent(convId: string, preview: string): void {
  const rows = getCachedRows();
  if (!rows) return;
  const next = applySentPatch(rows, convId, preview, Date.now());
  if (next === null) return;
  setCachedRows(next);
}