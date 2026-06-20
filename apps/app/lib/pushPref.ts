/** @file Device-local persisted boolean preference gating whether this device registers its push token with the daemon (default ON), built on the shared value-store factory. */

/** Device-local push preference: a persisted boolean gating whether this device registers its push token with the daemon (default ON), built on the persistedStore value-store factory so the registration path reads synchronously and the Settings toggle repaints on flip. */

import { createValueStore } from './persistedStore';

const STORAGE_KEY = 'push.enabled';

/** Stored as '1' / '0'. Missing or unrecognised -> default ON. The historical loader also treated the legacy string 'false' as off. */
const store = createValueStore<boolean>({
  key: STORAGE_KEY,
  default: true,
  serialize: (v) => (v ? '1' : '0'),
  deserialize: (raw) => (raw === '0' || raw === 'false' ? false : true),
  alwaysNotify: true,
});

/** Read the persisted preference once and cache it. Subsequent calls return the cached value without touching storage. Missing -> enabled (default ON). */
export const loadPushEnabled = (): Promise<boolean> => store.load();

/** Synchronous read from the in-memory cache. Returns the default (true) until `loadPushEnabled` has run. */
export const isPushEnabledSync = (): boolean => store.get();

/** Persist + apply a new preference, update the cache, and notify subscribers. */
export const setPushEnabled = (enabled: boolean): Promise<void> => store.setAsync(enabled);

/** Subscribe to preference changes. Returns an unsubscribe fn. */
export const subscribePushPref = (cb: () => void): () => void => store.subscribe(cb);
