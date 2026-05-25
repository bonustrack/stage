/** Persisted channels-list cache for the web messenger. Web counterpart to
 *  `apps/app/lib/channelsCache.ts` — same hydrate/persist/markRead pattern,
 *  storage swapped from expo-file-system to localStorage.
 *
 *  Hydrating on mount lets the Channels page render the list before XMTP
 *  finishes booting (`Client.build` + `syncAll` add 2-5s on a cold load). */

import { ref, type Ref } from 'vue';
import { setLastReadNs } from './xmtp';

export interface CachedRow {
  convId: string;
  unreadCount: number;
  lastReadNs: number;
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

/** Mark a conv as read NOW — clears the badge + persists lastReadNs. */
export function markConvRead(convId: string): void {
  const nowNs = Date.now() * 1_000_000;
  setLastReadNs(convId, nowNs);
  if (!cachedRows.value) return;
  const idx = cachedRows.value.findIndex(r => r.convId === convId);
  if (idx === -1) return;
  const next = [...cachedRows.value];
  next[idx] = { ...cachedRows.value[idx]!, unreadCount: 0, lastReadNs: nowNs };
  setCachedRows(next);
}
