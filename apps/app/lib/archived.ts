/** Local (device-only) archived channels. Persists a set of archived
 *  conversation ids in AsyncStorage so the channels list can hide them and a
 *  dedicated "Archived" view can surface them. Mirrors lib/pins.ts exactly —
 *  in-memory cache + dependency-free pub/sub so both the channels list and the
 *  Archived view re-render the instant a conv is archived/unarchived.
 *
 *  WHY LOCAL (not XMTP consent): XMTP consent has only allowed/denied/unknown.
 *  `denied` already means "blocked / message-request rejected" — reusing it for
 *  archive would conflate archive with block (archived convs would vanish from
 *  the requests flow + read as blocked on every device). Archive needs a 4th,
 *  reversible "hide from inbox but not blocked" state that consent can't express,
 *  so we keep it device-local. True cross-device sync would need a dedicated
 *  archive flag (e.g. stored in XMTP appData / a self-DM) — a later step. */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'channels.archived';

/** In-memory mirror of the persisted set. Populated once by `loadArchivedIds`
 *  and kept in sync by `toggleArchived` so `isArchived` can answer synchronously. */
let cache: Set<string> = new Set();
let loaded = false;

/** Subscribers re-render when the archived set changes (toggle). */
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
export async function loadArchivedIds(): Promise<Set<string>> {
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
 *  `loadArchivedIds` has run. */
export function isArchived(convId: string): boolean {
  return cache.has(convId);
}

/** Flip a conv's archived membership, persist, update the cache, notify
 *  subscribers, and return the new set. */
export async function toggleArchived(convId: string): Promise<Set<string>> {
  const next = new Set(cache);
  if (next.has(convId)) next.delete(convId);
  else next.add(convId);
  cache = next;
  loaded = true;
  notify();
  await persist();
  return cache;
}

/** Subscribe to archive changes. Returns an unsubscribe fn. */
export function subscribeArchived(cb: () => void): () => void {
  subscribers.add(cb);
  return () => { subscribers.delete(cb); };
}
