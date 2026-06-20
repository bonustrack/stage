/** @file Device-local archived-channels store (AsyncStorage set + in-memory cache + dependency-free pub/sub) hiding conversations from the inbox so the channels list and a dedicated Archived view re-render instantly. */

/** Kept device-local rather than XMTP consent because consent's allowed/denied/unknown can't express a 4th reversible "hidden but not blocked" state; true cross-device sync would need a dedicated archive flag later. */

/** Built on the shared lib/persistedStore.ts set-store factory. */

import { createSetStore } from './persistedStore';

const store = createSetStore('channels.archived');

/** Read the persisted set once and cache it. Subsequent calls return the cached set without touching storage. */
export const loadArchivedIds = (): Promise<Set<string>> => store.load();

/** Synchronous membership check from the in-memory cache. Returns false until `loadArchivedIds` has run. */
export const isArchived = (convId: string): boolean => store.has(convId);

/** Flip a conv's archived membership, persist, update the cache, notify subscribers, and return the new set. */
export const toggleArchived = (convId: string): Promise<Set<string>> => store.toggle(convId);

/** Subscribe to archive changes. Returns an unsubscribe fn. */
export const subscribeArchived = (cb: () => void): () => void => store.subscribe(cb);
