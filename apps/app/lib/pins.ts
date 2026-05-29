/** Local (device-only) pinned channels. Persists a set of pinned conversation
 *  ids in AsyncStorage so the channels list can float them to the top. No
 *  cross-device sync — purely a per-device convenience. Dependency-free pub/sub
 *  lets the list re-render the instant a pin toggles. */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'channels.pinned';

/** In-memory mirror of the persisted set. Populated once by `loadPinnedIds`
 *  and kept in sync by `togglePin` so `isPinned` can answer synchronously. */
let cache: Set<string> = new Set();
let loaded = false;

/** Subscribers re-render when the pinned set changes (toggle). */
const subscribers = new Set<() => void>();

function notify(): void {
  for (const cb of subscribers) {
    try { cb(); } catch { /* a bad subscriber shouldn't break the rest */ }
  }
}

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...cache]));
  } catch { /* best-effort — the in-memory cache still reflects the toggle */ }
}

/** Read the persisted set once and cache it. Subsequent calls return the
 *  cached set without touching storage. */
export async function loadPinnedIds(): Promise<Set<string>> {
  if (loaded) return cache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    if (Array.isArray(ids)) cache = new Set(ids.filter(x => typeof x === 'string'));
  } catch { /* corrupt/missing → start empty */ }
  loaded = true;
  return cache;
}

/** Synchronous membership check from the in-memory cache. Returns false until
 *  `loadPinnedIds` has run. */
export function isPinned(convId: string): boolean {
  return cache.has(convId);
}

/** Flip a conv's pinned membership, persist, update the cache, notify
 *  subscribers, and return the new set. */
export async function togglePin(convId: string): Promise<Set<string>> {
  const next = new Set(cache);
  if (next.has(convId)) next.delete(convId);
  else next.add(convId);
  cache = next;
  loaded = true;
  notify();
  await persist();
  return cache;
}

/** Subscribe to pin changes. Returns an unsubscribe fn. */
export function subscribePins(cb: () => void): () => void {
  subscribers.add(cb);
  return () => { subscribers.delete(cb); };
}
