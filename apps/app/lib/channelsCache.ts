/** In-process channels-list cache shared between the Channels screen + any
 *  other surface that needs to reach in and mutate the unread count.
 *
 *  Persisted to a JSON file in the app document directory so the channels
 *  list renders immediately on cold start instead of blocking on
 *  `Client.build` + `syncAllConversations` (~3-8s on Less's network). The
 *  Channels screen re-syncs from the network in the background regardless,
 *  so the cache is always brought up to date within a few seconds. */

import { Directory, File, Paths } from 'expo-file-system';
import { setLastReadNs } from './xmtp';

export interface CachedRow {
  convId: string;
  unreadCount: number;
  lastReadNs: number;
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
 *  before the Channels screen re-syncs) AND writes the persistent
 *  `lastReadNs` SecureStore key so next mount agrees. */
export async function markConvRead(convId: string): Promise<void> {
  const nowNs = Date.now() * 1_000_000;
  await setLastReadNs(convId, nowNs);
  if (!rows) return;
  const idx = rows.findIndex(r => r.convId === convId);
  if (idx === -1) return;
  const next = [...rows];
  next[idx] = { ...rows[idx]!, unreadCount: 0, lastReadNs: nowNs };
  setCachedRows(next);
}
