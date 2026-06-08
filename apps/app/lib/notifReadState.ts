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
 *  Built on the shared lib/persistedStore.ts set-store factory; the add-only
 *  `markNotifsRead` / `unreadCount` helpers layer on top of it. */

import { createSetStore } from './persistedStore';

const store = createSetStore('notifications.read');

/** Read the persisted read-id set once and cache it. */
export const loadNotifReadState = (): Promise<Set<string>> => store.load();

/** Count of `ids` not yet marked read. Synchronous (uses the in-memory cache);
 *  returns `ids.length` until `loadNotifReadState` has run. */
export function unreadCount(ids: readonly string[]): number {
  let n = 0;
  for (const id of ids) if (!store.has(id)) n += 1;
  return n;
}

/** Mark the given notification ids read (idempotent). Prunes nothing, stale
 *  ids in the read set are harmless (they simply never match a pending id). */
export async function markNotifsRead(ids: readonly string[]): Promise<void> {
  const cur = store.get();
  const next = new Set(cur);
  for (const id of ids) next.add(id);
  if (next.size === cur.size) return;
  await store.set(next);
}

/** Subscribe to read-state changes. Returns an unsubscribe fn. */
export const subscribeNotifReadState = (cb: () => void): () => void => store.subscribe(cb);
