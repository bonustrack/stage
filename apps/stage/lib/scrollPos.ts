
import { appStorage } from '../platform/storage';

export const CHANNELS_SCROLL_KEY = 'scroll:channels';
export function convScrollKey(convId: string): string { return `scroll:conv:${convId}`; }
export function convAnchorKey(convId: string): string { return `scroll:anchor:${convId}`; }

export interface FeedAnchor { key: string; offset: number }

const anchors = new Map<string, FeedAnchor | null>();

function parseAnchor(raw: string | null): FeedAnchor | null {
  if (raw === null) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v === 'object' && v !== null && typeof (v as FeedAnchor).key === 'string' && typeof (v as FeedAnchor).offset === 'number') {
      return { key: (v as FeedAnchor).key, offset: (v as FeedAnchor).offset };
    }
  } catch { }
  return null;
}

export function peekFeedAnchor(convId: string): FeedAnchor | null | undefined {
  return anchors.get(convAnchorKey(convId));
}

export async function getFeedAnchor(convId: string): Promise<FeedAnchor | null> {
  const key = convAnchorKey(convId);
  const cached = anchors.get(key);
  if (cached !== undefined) return cached;
  const anchor = parseAnchor(await appStorage.get(key).catch(() => null));
  anchors.set(key, anchor);
  return anchor;
}

export function saveFeedAnchor(convId: string, anchor: FeedAnchor | null): void {
  const key = convAnchorKey(convId);
  anchors.set(key, anchor);
  const existing = timers.get(key);
  if (existing) clearTimeout(existing);
  timers.set(key, setTimeout(() => {
    timers.delete(key);
    const write = anchor === null ? appStorage.delete(key) : appStorage.set(key, JSON.stringify(anchor));
    void write.catch(() => undefined);
  }, WRITE_DEBOUNCE_MS));
}

const cache = new Map<string, number>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

const WRITE_DEBOUNCE_MS = 300;

export const AT_BOTTOM_THRESHOLD_PX = 24;

export function peekScrollOffset(key: string): number | undefined {
  return cache.get(key);
}

export async function getScrollOffset(key: string): Promise<number | undefined> {
  if (cache.has(key)) return cache.get(key);
  try {
    const raw = await appStorage.get(key);
    if (raw == null) return undefined;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return undefined;
    cache.set(key, n);
    return n;
  } catch { return undefined; }
}

export function saveScrollOffset(key: string, offset: number): void {
  if (!Number.isFinite(offset) || offset < 0) return;
  cache.set(key, offset);
  const existing = timers.get(key);
  if (existing) clearTimeout(existing);
  timers.set(key, setTimeout(() => {
    timers.delete(key);
    void appStorage.set(key, String(cache.get(key) ?? offset)).catch(() => undefined);
  }, WRITE_DEBOUNCE_MS));
}

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
    if (now > pinUntil) return 'skip';
    return 'bottom';
  }
  return { offset: Math.min(savedOffset, Math.max(0, contentHeight)), done: true };
}

export function markConvAtBottom(convId: string): void {
  flushScrollOffset(convScrollKey(convId), 0);
  saveFeedAnchor(convId, null);
}

export function flushScrollOffset(key: string, override?: number): void {
  const t = timers.get(key);
  if (t) { clearTimeout(t); timers.delete(key); }
  if (override != null && Number.isFinite(override) && override >= 0) {
    cache.set(key, override);
    void appStorage.set(key, String(override)).catch(() => undefined);
    return;
  }
  if (!t) return;
  const v = cache.get(key);
  if (v != null) void appStorage.set(key, String(v)).catch(() => undefined);
}
