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
 *  so we keep it device-local. CROSS-DEVICE SYNC is layered on top via
 *  lib/channelPrefsSync.ts (a self-owned MLS control group): toggleArchived
 *  keeps its instant local write AND fires a coalesced delta; the sync module
 *  folds remote deltas back in via applyArchivedFromSync (which does NOT
 *  re-emit, avoiding a feedback loop).
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

/** Flip a conv's archived membership, persist locally, notify subscribers, then
 *  fire a coalesced cross-device delta. The delta reflects the NEW membership.
 *  Sync is dynamically imported so this module stays free of the sync module's
 *  XMTP deps (and avoids an import cycle). */
export const toggleArchived = async (convId: string): Promise<Set<string>> => {
  const next = await store.toggle(convId);
  void import('./channelPrefsSync')
    .then(m => m.queuePrefDelta(convId, { archived: next.has(convId) }))
    .catch(() => undefined);
  return next;
};

/** Apply a synced archived decision (true=archived, false=unarchived) WITHOUT
 *  re-emitting a delta. Called by the sync fold; no-op when already in state. */
export const applyArchivedFromSync = (convId: string, archived: boolean): void => {
  if (store.has(convId) === archived) return;
  const next = new Set(store.get());
  if (archived) next.add(convId); else next.delete(convId);
  void store.set(next);
};

/** Subscribe to archive changes. Returns an unsubscribe fn. */
export const subscribeArchived = (cb: () => void): () => void => store.subscribe(cb);
