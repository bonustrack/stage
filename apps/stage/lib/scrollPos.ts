
import { appStorage } from '../platform/storage';

export const CHANNELS_SCROLL_KEY = 'scroll:channels';
export function convScrollKey(convId: string): string { return `scroll:conv:${convId}`; }
function convAnchorKey(convId: string): string { return `scroll:anchor:${convId}`; }

export interface FeedAnchor { key: string; offset: number }

const WRITE_DEBOUNCE_MS = 300;

export const AT_BOTTOM_THRESHOLD_PX = 24;

function debouncedKv<T>(parse: (raw: string | null) => T | undefined, write: (key: string, value: T) => Promise<void>) {
  const values = new Map<string, T>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const persist = (key: string): void => {
    const v = values.get(key);
    if (v !== undefined) void write(key, v).catch(() => undefined);
  };
  return {
    peek: (key: string): T | undefined => values.get(key),
    async get(key: string): Promise<T | undefined> {
      if (values.has(key)) return values.get(key);
      const v = parse(await appStorage.get(key).catch(() => null));
      if (v !== undefined) values.set(key, v);
      return v;
    },
    save(key: string, value: T): void {
      values.set(key, value);
      const existing = timers.get(key);
      if (existing) clearTimeout(existing);
      timers.set(key, setTimeout(() => { timers.delete(key); persist(key); }, WRITE_DEBOUNCE_MS));
    },
    flush(key: string, override?: T): void {
      const t = timers.get(key);
      if (t) { clearTimeout(t); timers.delete(key); }
      if (override !== undefined) values.set(key, override);
      if (override !== undefined || t) persist(key);
    },
  };
}

function isOffset(n: number | undefined): n is number {
  return n != null && Number.isFinite(n) && n >= 0;
}

function parseOffset(raw: string | null): number | undefined {
  if (raw == null) return undefined;
  const n = Number(raw);
  return isOffset(n) ? n : undefined;
}

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

const offsets = debouncedKv<number>(parseOffset, (key, v) => appStorage.set(key, String(v)));
const anchors = debouncedKv<FeedAnchor | null>(
  parseAnchor,
  (key, v) => (v === null ? appStorage.delete(key) : appStorage.set(key, JSON.stringify(v))),
);

export function peekFeedAnchor(convId: string): FeedAnchor | null | undefined {
  return anchors.peek(convAnchorKey(convId));
}

export async function getFeedAnchor(convId: string): Promise<FeedAnchor | null> {
  return (await anchors.get(convAnchorKey(convId))) ?? null;
}

export function saveFeedAnchor(convId: string, anchor: FeedAnchor | null): void {
  anchors.save(convAnchorKey(convId), anchor);
}

export function peekScrollOffset(key: string): number | undefined {
  return offsets.peek(key);
}

export function getScrollOffset(key: string): Promise<number | undefined> {
  return offsets.get(key);
}

export function saveScrollOffset(key: string, offset: number): void {
  if (isOffset(offset)) offsets.save(key, offset);
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
  offsets.flush(key, isOffset(override) ? override : undefined);
}
