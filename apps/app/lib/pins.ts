/** Local pinned channels. Persists a set of pinned conversation ids in
 *  AsyncStorage so the channels list can float them to the top. Dependency-free
 *  pub/sub lets the list re-render the instant a pin toggles. Cross-device sync
 *  is layered on via lib/channelPrefsSync.ts: togglePin keeps its instant local
 *  write AND fires a coalesced delta; remote deltas fold back in via
 *  applyPinnedFromSync (no re-emit, so no feedback loop).
 *
 *  Built on the shared lib/persistedStore.ts set-store factory. */

import { createSetStore } from './persistedStore';

const store = createSetStore('channels.pinned');

/** Read the persisted set once and cache it. Subsequent calls return the
 *  cached set without touching storage. */
export const loadPinnedIds = (): Promise<Set<string>> => store.load();

/** Synchronous membership check from the in-memory cache. Returns false until
 *  `loadPinnedIds` has run. */
export const isPinned = (convId: string): boolean => store.has(convId);

/** Flip a conv's pinned membership, persist locally, notify subscribers, then
 *  fire a coalesced cross-device delta reflecting the NEW membership. Sync is
 *  dynamically imported so this module stays free of the sync module's XMTP deps
 *  (and avoids an import cycle). */
export const togglePin = async (convId: string): Promise<Set<string>> => {
  const next = await store.toggle(convId);
  void import('./channelPrefsSync')
    .then(m => m.queuePrefDelta(convId, { pinned: next.has(convId) }))
    .catch(() => undefined);
  return next;
};

/** Apply a synced pin decision (true=pinned, false=unpinned) WITHOUT re-emitting
 *  a delta. Called by the sync fold; no-op when already in state. */
export const applyPinnedFromSync = (convId: string, pinned: boolean): void => {
  if (store.has(convId) === pinned) return;
  const next = new Set(store.get());
  if (pinned) next.add(convId); else next.delete(convId);
  void store.set(next);
};

/** Subscribe to pin changes. Returns an unsubscribe fn. */
export const subscribePins = (cb: () => void): () => void => store.subscribe(cb);
