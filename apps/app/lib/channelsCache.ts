/** In-process channels-list cache shared between the Channels screen + any
 *  other surface that needs to reach in and mutate the unread count (e.g. the
 *  conversation view marking a conv as read on mount).
 *
 *  Lives only for the JS lifetime — wiped on JS reload. The Channels screen
 *  re-syncs from the network on mount regardless, so a fresh boot doesn't
 *  notice the cache is empty. */

import { setLastReadNs } from './xmtp';

export interface CachedRow {
  convId: string;
  unreadCount: number;
  lastReadNs: number;
  /** Anything else the Channels screen attaches — opaque to this module. */
  [key: string]: unknown;
}

let rows: CachedRow[] | null = null;
const listeners = new Set<(rows: CachedRow[] | null) => void>();

export function getCachedRows(): CachedRow[] | null { return rows; }
export function setCachedRows(next: CachedRow[] | null): void {
  rows = next;
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
