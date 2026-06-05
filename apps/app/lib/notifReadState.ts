/** Notification read-state store (device-local).
 *
 *  The Notifications surface lists each pending message request as a
 *  notification entry. This store tracks which of those notifications the user
 *  has already seen, so we can show an unread count that is SPECIFIC to
 *  notifications (distinct from the channels-tab unread counter).
 *
 *  We persist the set of notification ids the user has marked read (here: the
 *  conversation id of each message request). `unreadCount(ids)` then = the
 *  number of currently-pending request ids NOT in the read set. Opening the
 *  Notifications page marks every currently-visible notification read.
 *
 *  Same dependency-free AsyncStorage + pub/sub shape as lib/pins.ts so the tab
 *  badge / header pill re-render the instant read-state changes. */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'notifications.read';

/** In-memory mirror of the persisted read-id set. */
let cache: Set<string> = new Set();
let loaded = false;

const subscribers = new Set<() => void>();

function notify(): void {
  for (const cb of subscribers) {
    try { cb(); } catch { /* a bad subscriber shouldn't break the rest */ }
  }
}

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...cache]));
  } catch { /* best-effort — in-memory cache still reflects the change */ }
}

/** Read the persisted read-id set once and cache it. */
export async function loadNotifReadState(): Promise<Set<string>> {
  if (loaded) return cache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    if (Array.isArray(ids)) cache = new Set(ids.filter(x => typeof x === 'string'));
  } catch { /* corrupt/missing → start empty */ }
  loaded = true;
  return cache;
}

/** Count of `ids` not yet marked read. Synchronous (uses the in-memory cache);
 *  returns `ids.length` until `loadNotifReadState` has run. */
export function unreadCount(ids: readonly string[]): number {
  let n = 0;
  for (const id of ids) if (!cache.has(id)) n += 1;
  return n;
}

/** Mark the given notification ids read (idempotent). Prunes nothing — stale
 *  ids in the read set are harmless (they simply never match a pending id). */
export async function markNotifsRead(ids: readonly string[]): Promise<void> {
  let changed = false;
  const next = new Set(cache);
  for (const id of ids) if (!next.has(id)) { next.add(id); changed = true; }
  if (!changed) return;
  cache = next;
  loaded = true;
  notify();
  await persist();
}

/** Subscribe to read-state changes. Returns an unsubscribe fn. */
export function subscribeNotifReadState(cb: () => void): () => void {
  subscribers.add(cb);
  return () => { subscribers.delete(cb); };
}
