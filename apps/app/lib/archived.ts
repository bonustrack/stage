/** Local (device-only) archived channels. Persists a set of archived
 *  conversation ids in AsyncStorage so the channels list can hide them and a
 *  dedicated "Archived" view can surface them. In-memory cache + dependency-free
 *  pub/sub so both the channels list and the Archived view re-render the instant
 *  a conv is archived/unarchived.
 *
 *  WHY LOCAL (not XMTP consent): XMTP consent has only allowed/denied/unknown.
 *  `denied` already means "blocked / message-request rejected", reusing it for
 *  archive would conflate archive with block (archived convs would vanish from
 *  the requests flow + read as blocked on every device). Archive needs a 4th,
 *  reversible "hide from inbox but not blocked" state that consent can't express,
 *  so we keep it device-local. True cross-device sync would need a dedicated
 *  archive flag (e.g. stored in XMTP appData / a self-DM), a later step.
 *
 *  Built on the shared lib/persistedStore.ts set-store factory. */

import { createSetStore } from './persistedStore';

const store = createSetStore('channels.archived');

/** Read the persisted set once and cache it. Subsequent calls return the
 *  cached set without touching storage. */
export const loadArchivedIds = (): Promise<Set<string>> => store.load();

/** Synchronous membership check from the in-memory cache. Returns false until
 *  `loadArchivedIds` has run. */
export const isArchived = (convId: string): boolean => store.has(convId);

/** Flip a conv's archived membership, persist, update the cache, notify
 *  subscribers, and return the new set. */
export const toggleArchived = (convId: string): Promise<Set<string>> => store.toggle(convId);

/** Subscribe to archive changes. Returns an unsubscribe fn. */
export const subscribeArchived = (cb: () => void): () => void => store.subscribe(cb);
