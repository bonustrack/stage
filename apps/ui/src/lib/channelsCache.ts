/** Persisted channels-list cache for the web messenger. Web counterpart to
 *  `apps/app/lib/channelsCache.ts` — same hydrate/persist/markRead pattern,
 *  storage swapped from expo-file-system to localStorage.
 *
 *  Hydrating on mount lets the Channels page render the list before XMTP
 *  finishes booting (`Client.build` + `syncAll` add 2-5s on a cold load). */

import { ref, type Ref } from 'vue';
import { markConvReadSynced, markConvUnreadSynced } from './xmtp';

export interface CachedRow {
  convId: string;
  unreadCount: number;
  lastReadNs: number;
  /** Synced (cross-device) "explicitly marked unread" flag, driven by XMTP
   *  conversation consent state. Forces a badge even when the count is 0. */
  markedUnread?: boolean;
  [key: string]: unknown;
}

const STORAGE_KEY = 'metro.channels.cache.v1';

/** Reactive ref shared across screens. Hydrated lazily on first access. */
export const cachedRows: Ref<CachedRow[] | null> = ref<CachedRow[] | null>(null);
let hydrated = false;

export function hydrateCachedRows(): CachedRow[] | null {
  if (hydrated) return cachedRows.value;
  hydrated = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return cachedRows.value;
    const parsed = JSON.parse(raw) as CachedRow[];
    if (Array.isArray(parsed)) cachedRows.value = parsed;
  } catch { /* corrupted cache — next setCachedRows overwrites it */ }
  return cachedRows.value;
}

export function setCachedRows(next: CachedRow[] | null): void {
  cachedRows.value = next;
  try {
    if (next === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch { /* quota — best effort */ }
}

/** Mark a conv as read NOW — clears the badge, persists lastReadNs, and flips
 *  the synced consent flag to Allowed so other installations agree. */
export function markConvRead(convId: string): void {
  const nowNs = Date.now() * 1_000_000;
  void markConvReadSynced(convId);
  if (!cachedRows.value) return;
  const idx = cachedRows.value.findIndex(r => r.convId === convId);
  if (idx === -1) return;
  const next = [...cachedRows.value];
  next[idx] = { ...cachedRows.value[idx]!, unreadCount: 0, lastReadNs: nowNs, markedUnread: false };
  setCachedRows(next);
}

/** Mark a conv as UNREAD — cross-device. Flips the synced consent flag to
 *  Unknown, rewinds the local lastReadNs, and patches the cached row so the
 *  badge appears immediately on this device. */
export function markConvUnread(convId: string): void {
  void markConvUnreadSynced(convId);
  if (!cachedRows.value) return;
  const idx = cachedRows.value.findIndex(r => r.convId === convId);
  if (idx === -1) return;
  const next = [...cachedRows.value];
  const cur = cachedRows.value[idx]!;
  next[idx] = { ...cur, unreadCount: Math.max(1, cur.unreadCount), lastReadNs: 0, markedUnread: true };
  setCachedRows(next);
}

/** Apply a consent change that arrived from another device (via the consent
 *  stream) to the cached rows so the badge reconciles live without a refetch. */
export function applyConsentToRows(convId: string, markedUnread: boolean): void {
  if (!cachedRows.value) return;
  const idx = cachedRows.value.findIndex(r => r.convId === convId);
  if (idx === -1) return;
  const cur = cachedRows.value[idx]!;
  if (!!cur.markedUnread === markedUnread) return;
  const next = [...cachedRows.value];
  next[idx] = markedUnread
    ? { ...cur, markedUnread: true, unreadCount: Math.max(1, cur.unreadCount) }
    : { ...cur, markedUnread: false, unreadCount: 0 };
  setCachedRows(next);
}
