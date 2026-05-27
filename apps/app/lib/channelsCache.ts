/** In-process channels-list cache shared between the Channels screen + any
 *  other surface that needs to reach in and mutate the unread count.
 *
 *  Persisted to a JSON file in the app document directory so the channels
 *  list renders immediately on cold start instead of blocking on
 *  `Client.build` + `syncAllConversations` (~3-8s on Less's network). The
 *  Channels screen re-syncs from the network in the background regardless,
 *  so the cache is always brought up to date within a few seconds. */

import { Directory, File, Paths } from 'expo-file-system';
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

let rows: CachedRow[] | null = null;
let hydrated = false;
const listeners = new Set<(rows: CachedRow[] | null) => void>();

function cacheFile(): File {
  const dir = new Directory(Paths.document, 'metro');
  if (!dir.exists) dir.create({ intermediates: true });
  return new File(dir, 'channels-cache.json');
}

/** Pull the persisted cache off disk into the in-process slot. Idempotent —
 *  the file read only happens on the first call. Safe to call from a render
 *  effect; the result lands in `rows` synchronously after this awaits. */
export async function hydrateCachedRows(): Promise<CachedRow[] | null> {
  if (hydrated) return rows;
  hydrated = true;
  try {
    const f = cacheFile();
    if (!f.exists) return rows;
    const raw = await f.text();
    const parsed = JSON.parse(raw) as CachedRow[];
    if (Array.isArray(parsed)) {
      rows = parsed;
      for (const l of listeners) l(rows);
    }
  } catch { /* corrupted cache — next setCachedRows overwrites it */ }
  return rows;
}

function persistCachedRows(next: CachedRow[] | null): void {
  try {
    const f = cacheFile();
    if (next === null) { if (f.exists) f.delete(); return; }
    f.write(JSON.stringify(next));
  } catch { /* best-effort */ }
}

export function getCachedRows(): CachedRow[] | null { return rows; }
export function setCachedRows(next: CachedRow[] | null): void {
  rows = next;
  persistCachedRows(next);
  for (const l of listeners) l(rows);
}
export function subscribeCachedRows(l: (rows: CachedRow[] | null) => void): () => void {
  listeners.add(l);
  return (): void => { listeners.delete(l); };
}

/** Mark a conv as read NOW — patches the cached row (so the badge clears
 *  before the Channels screen re-syncs), writes the persistent `lastReadNs`
 *  SecureStore key so next mount agrees, AND flips the synced consent flag to
 *  'allowed' so other installations of this inbox see it as read too. */
export async function markConvRead(convId: string): Promise<void> {
  const nowNs = Date.now() * 1_000_000;
  await markConvReadSynced(convId);
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

/** Apply a consent change that arrived from another device (via the consent
 *  stream) to the cached rows so the badge reconciles live without a refetch. */
export function applyConsentToRows(convId: string, markedUnread: boolean): void {
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
