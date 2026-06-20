/** @file Account-scoped, disk-persisted channels-list cache (rows, unread counts) where each account keeps its own JSON store + in-memory mirror; switching accounts swaps the active pointer (no wipe) so rows render instantly on cold start and the live stream/summarize revalidates in the background. */

import { PersistentStore } from './cache';
import { markConvReadSynced, markConvUnreadSynced } from './xmtp';

export interface CachedRow {
  convId: string;
  unreadCount: number;
  lastReadNs: number;
  /** "Explicitly marked unread" flag, driven by the per-device `lastReadNs` marker (lastReadNs === 0 with an inbound last message). When true the row shows a badge even if the timestamp-based count is 0. */
  markedUnread?: boolean;
  /** Anything else the Channels screen attaches — opaque to this module. */
  [key: string]: unknown;
}

/** One PersistentStore per account id, lazily created. Each account's rows live in their own file so cross-account data is retained — switching accounts never clears another account's cache. */
const stores = new Map<string, PersistentStore<CachedRow[]>>();

/** Account id whose store the unscoped API (getCachedRows / setCachedRows / subscribeCachedRows / mark*) currently reads + writes. Defaults to a shared bucket until the active account is known (set on boot + on switch). */
const DEFAULT_KEY = '__default__';
let activeId: string = DEFAULT_KEY;

/** Subscribers to the ACTIVE account's rows. They follow the active pointer: on an account switch we re-notify them with the new account's rows so the Channels screen swaps instantly without a refetch. */
const activeListeners = new Set<(rows: CachedRow[] | null) => void>();
/** Per-store unsubscribe for the currently-active store, so we can detach when the active pointer moves. */
let activeStoreUnsub: (() => void) | null = null;

/** Deferred + coalesced fan-out: mutators update the store synchronously but listeners are deferred to a microtask (so setState never fires mid-render of a different component), with a single scheduled flag coalescing rapid writes into one flush that reads the latest rows once. */
let notifyScheduled = false;
/** Notify Active. */
function notifyActive(): void {
  if (notifyScheduled) return;
  notifyScheduled = true;
  queueMicrotask(() => {
    notifyScheduled = false;
    const v = activeStore().get();
    for (const l of activeListeners) l(v);
  });
}

/** File Name For. */
function fileNameFor(id: string): string {
  /** Sanitise the id for a filename (account ids are lowercased addresses, but be defensive). The legacy single-account file name is preserved for the default bucket so an existing cache isn't orphaned. */
  if (id === DEFAULT_KEY) return 'channels-cache.json';
  const safe = id.replace(/[^A-Za-z0-9._-]/g, '_');
  return `channels-cache.${safe}.json`;
}

/** Set the For. */
function storeFor(id: string): PersistentStore<CachedRow[]> {
  let s = stores.get(id);
  /** Debounced: this store is written per streamed message (setRows write-through) with a 100s-of-KB payload; the trailing-flush + AppState-background flush in PersistentStore keeps those off the JS thread without losing data on kill. */
  if (!s) { s = new PersistentStore<CachedRow[]>(fileNameFor(id), true); stores.set(id, s); }
  return s;
}

/** Active Store. */
function activeStore(): PersistentStore<CachedRow[]> { return storeFor(activeId); }

/** Synchronous snapshot of the active account id for react-query keys that scope cached data per account (so switching back to an account hits cache instead of re-fetching); stable per account, unlike the monotonic account epoch. */
export function getActiveAccountIdSync(): string { return activeId; }

/** Wire the active store's pub/sub to the active-listener set, so writes to the active account (including stream write-through) fan out to the Channels screen. Called whenever the active pointer changes. */
function bindActiveStore(): void {
  if (activeStoreUnsub) { try { activeStoreUnsub(); } catch { /* ignore */ } activeStoreUnsub = null; }
  activeStoreUnsub = activeStore().subscribe(() => { notifyActive(); });
}
bindActiveStore();

/** Point the unscoped API at a specific account's store (on boot + every switch, replacing the old clear-on-switch): swap the active pointer, re-bind pub/sub, notify subscribers with the target's current rows instantly, then lazily hydrate its file; cross-account data is untouched. */
export function setActiveAccountForCache(id: string | null): void {
  const next = id !== null && id !== '' ? id : DEFAULT_KEY;
  if (next === activeId) return;
  activeId = next;
  bindActiveStore();
  const s = activeStore();
  /** Swap to whatever's already in memory for this account (deferred so it can never land during another component's render). */
  notifyActive();
  /** Lazy hydrate from this account's file; the store's own subscribe (bound above) re-notifies active listeners when the disk read lands. */
  void s.hydrate();
}

/** Pull the persisted cache (for the ACTIVE account) off disk into the in-process slot. Idempotent — the file read only happens on the first call per account. Safe to call from a render effect. */
export async function hydrateCachedRows(): Promise<CachedRow[] | null> {
  const v = await activeStore().hydrate();
  return Array.isArray(v) ? v : null;
}

/** Clear ONLY the active account's persisted + in-memory cache. Use on account REMOVAL (its data is gone for good), NOT on switch — switching now retains every account's cache and just swaps the active pointer. */
export function clearCachedRows(): void { activeStore().clear(); }

/** Cached channel rows for the active account, or null if none. */
export function getCachedRows(): CachedRow[] | null { return activeStore().get(); }
/** Replace the active account's cached channel rows. */
export function setCachedRows(next: CachedRow[] | null): void { activeStore().set(next); }
/** Subscribe to active-account row changes. Returns an unsubscribe fn. */
export function subscribeCachedRows(l: (rows: CachedRow[] | null) => void): () => void {
  activeListeners.add(l);
  return () => { activeListeners.delete(l); };
}

/** Latest in-memory rows for the active account. */
function currentRows(): CachedRow[] | null { return activeStore().get(); }

/** Mark a conv read now: patch the cached row so the badge clears before the Channels screen re-syncs and write the persistent per-device `lastReadNs` SecureStore key so next mount agrees (no longer touches XMTP consent). */
export async function markConvRead(convId: string): Promise<void> {
  const nowNs = Date.now() * 1_000_000;
  await markConvReadSynced(convId);
  const rows = currentRows();
  if (!rows) return;
  const idx = rows.findIndex(r => r.convId === convId);
  const cur = rows[idx];
  if (cur === undefined) return;
  const next = [...rows];
  next[idx] = { ...cur, unreadCount: 0, lastReadNs: nowNs, markedUnread: false };
  setCachedRows(next);
}

/** Mark a conv as UNREAD. Rewinds the local lastReadNs to 0 and patches the cached row so the badge appears immediately on this device. */
export async function markConvUnread(convId: string): Promise<void> {
  await markConvUnreadSynced(convId);
  const rows = currentRows();
  if (!rows) return;
  const idx = rows.findIndex(r => r.convId === convId);
  const cur = rows[idx];
  if (cur === undefined) return;
  const next = [...rows];
  /** Surface at least one unread so the badge shows even when the timestamp recount hasn't run yet. */
  next[idx] = { ...cur, unreadCount: Math.max(1, cur.unreadCount), lastReadNs: 0, markedUnread: true };
  setCachedRows(next);
}

/** Patch a row's preview after a LOCAL send (self-sends don't reliably replay through `streamAllMessages`): bump `lastTs`, set the preview, mark from-self, zero unread, and re-sort newest-first so the conv jumps to the top; no-op if the row isn't cached yet. */
export function patchRowSent(convId: string, preview: string): void {
  const rows = currentRows();
  if (!rows) return;
  const idx = rows.findIndex(r => r.convId === convId);
  const cur = rows[idx];
  if (cur === undefined) return;
  const updated: CachedRow = {
    ...cur,
    lastTs: Date.now(),
    lastPreview: preview.slice(0, 80),
    lastFromSelf: true,
    unreadCount: 0,
    markedUnread: false,
  };
  /** Move the just-touched conv to the top — the list is sorted newest-first. */
  const next = [updated, ...rows.slice(0, idx), ...rows.slice(idx + 1)];
  setCachedRows(next);
}