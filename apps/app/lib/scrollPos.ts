/** Persisted scroll offsets so reopening the app returns the user to roughly the
 *  same place — both the channels list (home) and each conversation's message
 *  list. Device-only, no cross-device sync. Reuses the same AsyncStorage +
 *  in-memory-mirror + debounced-write pattern as `pins.ts`/`drafts.ts`; no new
 *  storage dependency.
 *
 *  Keys: `scroll:channels` (fixed, the home list) and `scroll:conv:<convId>`
 *  (per conversation). Values are the FlatList `contentOffset.y` at write time.
 *  For the conversation list this offset is in the INVERTED coordinate space
 *  (0 = newest/bottom), which is exactly what `scrollToOffset` restores. */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const CHANNELS_SCROLL_KEY = 'scroll:channels';
export function convScrollKey(convId: string): string { return `scroll:conv:${convId}`; }

/** In-memory mirror so a restore on mount can answer synchronously after the
 *  one-time load, and repeated writes coalesce without hitting storage each time. */
const cache = new Map<string, number>();
/** Per-key debounce timers — writes are flushed ~300ms after the last scroll. */
const timers = new Map<string, ReturnType<typeof setTimeout>>();

const WRITE_DEBOUNCE_MS = 300;

/** Read a saved offset. Returns the cached value if present, else reads storage
 *  once. A missing/invalid entry resolves to undefined → caller keeps default. */
export async function getScrollOffset(key: string): Promise<number | undefined> {
  if (cache.has(key)) return cache.get(key);
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw == null) return undefined;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return undefined;
    cache.set(key, n);
    return n;
  } catch { return undefined; }
}

/** Debounced persist of an offset. Updates the in-memory cache immediately and
 *  flushes to AsyncStorage after the debounce window. Negative/non-finite
 *  offsets are ignored. */
export function saveScrollOffset(key: string, offset: number): void {
  if (!Number.isFinite(offset) || offset < 0) return;
  cache.set(key, offset);
  const existing = timers.get(key);
  if (existing) clearTimeout(existing);
  timers.set(key, setTimeout(() => {
    timers.delete(key);
    void AsyncStorage.setItem(key, String(cache.get(key) ?? offset)).catch(() => { /* best-effort */ });
  }, WRITE_DEBOUNCE_MS));
}

/** Cancel a pending debounced write for a key (e.g. on unmount) and flush the
 *  latest cached value synchronously-ish so a quick close doesn't lose it. */
export function flushScrollOffset(key: string): void {
  const t = timers.get(key);
  if (!t) return;
  clearTimeout(t);
  timers.delete(key);
  const v = cache.get(key);
  if (v != null) void AsyncStorage.setItem(key, String(v)).catch(() => { /* best-effort */ });
}
