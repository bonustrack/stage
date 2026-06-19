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

/** Storage key for the channel list's saved scroll offset. */
export const CHANNELS_SCROLL_KEY = 'scroll:channels';
/** Storage key for a single conversation's saved scroll offset. */
export function convScrollKey(convId: string): string { return `scroll:conv:${convId}`; }

/** In-memory mirror so a restore on mount can answer synchronously after the
 *  one-time load, and repeated writes coalesce without hitting storage each time. */
const cache = new Map<string, number>();
/** Per-key debounce timers — writes are flushed ~300ms after the last scroll. */
const timers = new Map<string, ReturnType<typeof setTimeout>>();

const WRITE_DEBOUNCE_MS = 300;

/** Inverted feed: within this many px of offset 0 counts as "at the bottom"
 *  (newest message visible). When the user leaves from here we must NOT restore
 *  a concrete offset on return — new messages may have arrived, making any old
 *  offset stale. Storing 0 makes restore a no-op so the feed lands at the
 *  bottom/newest. */
export const AT_BOTTOM_THRESHOLD_PX = 24;

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

/** Decide what the inverted conversation feed should do on each
 *  `onContentSizeChange` during the initial (epoch-0) mount.
 *
 *  Returns:
 *   - `'skip'`  — not ready / already done; do nothing.
 *   - `'bottom'`— pin to offset 0 (newest). Used for the at-bottom sentinel
 *     (null/<=0 saved offset): the feed is seeded synchronously from feedCache
 *     (which may already hold a message that arrived while the user was away),
 *     then the async local→sync→network refresh rewrites the slice — that churn
 *     under `maintainVisibleContentPosition` drifts the inverted viewport
 *     mid-feed. We keep re-pinning to 0 for a short settle window (caller's
 *     `pinUntil`) to beat that drift. This is the "return after a new message
 *     lands you mid-feed" fix.
 *   - a number — clamped concrete offset to restore (user left mid-scroll).
 *
 *  The caller owns the latch refs (`didRestore`, `pinUntil`) and the actual
 *  `scrollToOffset` call; this stays a pure decision so the component is thin. */
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
    if (now > pinUntil) return 'skip'; // settled — caller latches didRestore
    return 'bottom';
  }
  return { offset: Math.min(savedOffset, Math.max(0, contentHeight)), done: true };
}

/** Force-mark a conversation as at-bottom: persist the sentinel 0 immediately so
 *  a later leave restores to the newest message. Used by the jump-to-bottom
 *  button, whose list remount lands at offset 0 but may not emit an onScroll to
 *  update the at-bottom ref. */
export function markConvAtBottom(convId: string): void {
  flushScrollOffset(convScrollKey(convId), 0);
}

/** Cancel a pending debounced write for a key (e.g. on unmount) and flush the
 *  latest cached value synchronously-ish so a quick close doesn't lose it.
 *  Pass an `override` to FORCE-persist a definitive value (e.g. the at-bottom
 *  sentinel 0) regardless of any pending/stale cached offset — this beats the
 *  flush race where the last `onScroll` before a fast back-nav was mid-scroll
 *  and never reported the final at-bottom position. */
export function flushScrollOffset(key: string, override?: number): void {
  const t = timers.get(key);
  if (t) { clearTimeout(t); timers.delete(key); }
  if (override != null && Number.isFinite(override) && override >= 0) {
    cache.set(key, override);
    void AsyncStorage.setItem(key, String(override)).catch(() => { /* best-effort */ });
    return;
  }
  if (!t) return; // nothing pending, no override → leave the last persisted value
  const v = cache.get(key);
  if (v != null) void AsyncStorage.setItem(key, String(v)).catch(() => { /* best-effort */ });
}
