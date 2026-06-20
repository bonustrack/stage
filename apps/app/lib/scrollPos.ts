/** @file Device-only persisted FlatList scroll offsets (home channels list + each conversation) via the AsyncStorage + in-memory-mirror + debounced-write pattern, so reopening returns the user to roughly the same place; conversation offsets are in the inverted coordinate space scrollToOffset restores. */

import AsyncStorage from '@react-native-async-storage/async-storage';

/** Storage key for the channel list's saved scroll offset. */
export const CHANNELS_SCROLL_KEY = 'scroll:channels';
/** Storage key for a single conversation's saved scroll offset. */
export function convScrollKey(convId: string): string { return `scroll:conv:${convId}`; }

/** In-memory mirror so a restore on mount can answer synchronously after the one-time load, and repeated writes coalesce without hitting storage each time. */
const cache = new Map<string, number>();
/** Per-key debounce timers — writes are flushed ~300ms after the last scroll. */
const timers = new Map<string, ReturnType<typeof setTimeout>>();

const WRITE_DEBOUNCE_MS = 300;

/** Inverted feed: within this many px of offset 0 counts as at-the-bottom (newest visible); leaving from here stores 0 so restore is a no-op and the feed lands at the newest rather than a stale offset. */
export const AT_BOTTOM_THRESHOLD_PX = 24;

/** Read a saved offset. Returns the cached value if present, else reads storage once. A missing/invalid entry resolves to undefined → caller keeps default. */
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

/** Debounced persist of an offset. Updates the in-memory cache immediately and flushes to AsyncStorage after the debounce window. Negative/non-finite offsets are ignored. */
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

/** Pure decision for the inverted feed's epoch-0 onContentSizeChange: 'skip' (not ready/done), 'bottom' (re-pin to 0 through a settle window for the at-bottom sentinel, beating refresh-churn drift), or a clamped offset to restore; caller owns the latch refs and scrollToOffset. */
export function planFeedRestore(args: {
  loaded: boolean; contentHeight: number; itemCount: number;
  savedOffset: number | undefined; now: number;
  pinUntil: number; setPinUntil: (t: number) => void;
}): 'skip' | 'bottom' | { offset: number; done: true } {
  const { loaded, contentHeight, itemCount, savedOffset, now, pinUntil, setPinUntil } = args;
  if (!loaded) return 'skip';
  if (contentHeight <= 0 || itemCount === 0) return 'skip';
  if (savedOffset == null || savedOffset <= 0) {
    if (pinUntil === 0) { setPinUntil(now + 1200); return 'bottom'; }
    if (now > pinUntil) return 'skip'; /** settled — caller latches didRestore */
    return 'bottom';
  }
  return { offset: Math.min(savedOffset, Math.max(0, contentHeight)), done: true };
}

/** Force-mark a conversation at-bottom by persisting the sentinel 0 immediately, for the jump-to-bottom button whose remount lands at offset 0 but may not emit an onScroll to update the at-bottom ref. */
export function markConvAtBottom(convId: string): void {
  flushScrollOffset(convScrollKey(convId), 0);
}

/** Cancel a pending debounced write and flush the latest cached offset so a quick close doesn't lose it; an `override` force-persists a definitive value (e.g. the at-bottom sentinel 0), beating the race where the last onScroll before a fast back-nav was mid-scroll. */
export function flushScrollOffset(key: string, override?: number): void {
  const t = timers.get(key);
  if (t) { clearTimeout(t); timers.delete(key); }
  if (override != null && Number.isFinite(override) && override >= 0) {
    cache.set(key, override);
    void AsyncStorage.setItem(key, String(override)).catch(() => { /* best-effort */ });
    return;
  }
  if (!t) return; /** nothing pending, no override → leave the last persisted value */
  const v = cache.get(key);
  if (v != null) void AsyncStorage.setItem(key, String(v)).catch(() => { /* best-effort */ });
}
