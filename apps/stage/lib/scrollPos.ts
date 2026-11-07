import { z } from 'zod';
import { appStorage } from '../platform/storage';
import { ignore, ignored } from './errorPolicy';
import { jsonWith } from './storeCore';
import { writeBehind } from './writeBehind';

export const CHANNELS_SCROLL_KEY = 'scroll:channels';
export function convScrollKey(convId: string): string {
  return `scroll:conv:${convId}`;
}
function convAnchorKey(convId: string): string {
  return `scroll:anchor:${convId}`;
}

export interface FeedAnchor {
  key: string;
  offset: number;
}

const WRITE_DEBOUNCE_MS = 300;

function debouncedKv<T>(parse: (raw: string | null) => T | undefined, write: (key: string, value: T) => Promise<void>) {
  const values = new Map<string, T>();
  const writes = writeBehind<T>({ delayMs: WRITE_DEBOUNCE_MS }, (key, value) => {
    ignore(write(key, value), 'cache');
  });
  const save = (key: string, value: T): void => {
    values.set(key, value);
    writes.set(key, value);
  };
  return {
    peek: (key: string): T | undefined => values.get(key),
    async get(key: string): Promise<T | undefined> {
      if (values.has(key)) return values.get(key);
      const v = parse(await appStorage.get(key).catch(ignored(null, 'cache')));
      if (v !== undefined) values.set(key, v);
      return v;
    },
    save,
    flush(key: string, override?: T): void {
      if (override !== undefined) save(key, override);
      writes.flush(key);
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

const anchorJson = jsonWith(z.object({ key: z.string(), offset: z.number() }));

function parseAnchor(raw: string | null): FeedAnchor | null {
  return raw === null ? null : (anchorJson(raw) ?? null);
}

const offsets = debouncedKv<number>(parseOffset, (key, v) => appStorage.set(key, String(v)));
const anchors = debouncedKv<FeedAnchor | null>(parseAnchor, (key, v) =>
  v === null ? appStorage.delete(key) : appStorage.set(key, JSON.stringify(v)),
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

export function markConvAtBottom(convId: string): void {
  flushScrollOffset(convScrollKey(convId), 0);
  saveFeedAnchor(convId, null);
}

export function flushScrollOffset(key: string, override?: number): void {
  offsets.flush(key, isOffset(override) ? override : undefined);
}
