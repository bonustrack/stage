/** In-process channels-list cache shared between the Channels screen + any
 *  other surface that needs to reach in and mutate the unread count.
 *
 *  Persisted to a JSON file in the app document directory so the channels
 *  list renders immediately on cold start instead of blocking on
 *  `Client.build` + `syncAllConversations` (~3-8s on Less's network). The
 *  Channels screen re-syncs from the network in the background regardless,
 *  so the cache is always brought up to date within a few seconds. */

import { PersistentStore } from './cache';
import { markConvReadSynced, markConvUnreadSynced } from './xmtp';

export interface CachedRow {
  convId: string;
  unreadCount: number;
  lastReadNs: number;
  /** Synced (cross-device) "explicitly marked unread" flag, driven by XMTP
   *  conversation consent state. When true the row shows a badge even if the
   *  timestamp-based count is 0. */
  markedUnread?: boolean;
  /** Anything else the Channels screen attaches — opaque to this module. */
  [key: string]: unknown;
}

/** Channels list lives in the unified persistence layer (lib/cache) — one JSON
 *  file in the app document dir, mirrored in memory with pub/sub. The thin
 *  wrappers below preserve the previous module surface so callers are unchanged. */
const store = new PersistentStore<CachedRow[]>('channels-cache.json');

/** Pull the persisted cache off disk into the in-process slot. Idempotent —
 *  the file read only happens on the first call. Safe to call from a render
 *  effect; the result lands in `rows` synchronously after this awaits. */
export async function hydrateCachedRows(): Promise<CachedRow[] | null> {
  const v = await store.hydrate();
  return Array.isArray(v) ? v : null;
}

/** Wipe the persisted + in-memory cache. Called on account switch so the next
 *  account never momentarily shows the previous account's channels/avatars (the
 *  cache file is global, not per-account). */
export function clearCachedRows(): void { store.clear(); }

export function getCachedRows(): CachedRow[] | null { return store.get(); }
export function setCachedRows(next: CachedRow[] | null): void { store.set(next); }
export function subscribeCachedRows(l: (rows: CachedRow[] | null) => void): () => void {
  return store.subscribe(l);
}

/** Latest in-memory rows, for code that previously read the module-level
 *  `rows`. */
function currentRows(): CachedRow[] | null { return store.get(); }

/** Mark a conv as read NOW — patches the cached row (so the badge clears
 *  before the Channels screen re-syncs), writes the persistent `lastReadNs`
 *  SecureStore key so next mount agrees, AND flips the synced consent flag to
 *  'allowed' so other installations of this inbox see it as read too. */
export async function markConvRead(convId: string): Promise<void> {
  const nowNs = Date.now() * 1_000_000;
  await markConvReadSynced(convId);
  const rows = currentRows();
  if (!rows) return;
  const idx = rows.findIndex(r => r.convId === convId);
  if (idx === -1) return;
  const next = [...rows];
  next[idx] = { ...rows[idx]!, unreadCount: 0, lastReadNs: nowNs, markedUnread: false };
  setCachedRows(next);
}

/** Mark a conv as UNREAD — cross-device. Flips the synced consent flag to
 *  'unknown', rewinds the local lastReadNs, and patches the cached row so the
 *  badge appears immediately on this device. */
export async function markConvUnread(convId: string): Promise<void> {
  await markConvUnreadSynced(convId);
  const rows = currentRows();
  if (!rows) return;
  const idx = rows.findIndex(r => r.convId === convId);
  if (idx === -1) return;
  const next = [...rows];
  /** Surface at least one unread so the badge shows even when the timestamp
   *  recount hasn't run yet. */
  const cur = rows[idx]!;
  next[idx] = { ...cur, unreadCount: Math.max(1, cur.unreadCount), lastReadNs: 0, markedUnread: true };
  setCachedRows(next);
}

/** Patch a row's last-message preview after the LOCAL user sends — XMTP
 *  self-sends don't reliably replay through `streamAllMessages`, so without
 *  this the channels list keeps showing the previous preview/timestamp until
 *  the next 30s poll or app resume. Mirrors the stream-update path: bump
 *  `lastTs`, set the preview, mark it as from self, and re-sort newest-first so
 *  the conversation jumps to the top. Reading the conv also clears unread, so we
 *  zero those here too. No-op if the row isn't cached yet (a fresh conv lands on
 *  the next network refresh). */
export function patchRowSent(convId: string, preview: string): void {
  const rows = currentRows();
  if (!rows) return;
  const idx = rows.findIndex(r => r.convId === convId);
  if (idx === -1) return;
  const cur = rows[idx]!;
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

/** Apply a consent change that arrived from another device (via the consent
 *  stream) to the cached rows so the badge reconciles live without a refetch. */
export function applyConsentToRows(convId: string, markedUnread: boolean): void {
  const rows = currentRows();
  if (!rows) return;
  const idx = rows.findIndex(r => r.convId === convId);
  if (idx === -1) return;
  const cur = rows[idx]!;
  if (!!cur.markedUnread === markedUnread) return;
  const next = [...rows];
  next[idx] = markedUnread
    ? { ...cur, markedUnread: true, unreadCount: Math.max(1, cur.unreadCount) }
    : { ...cur, markedUnread: false, unreadCount: 0 };
  setCachedRows(next);
}
