/** Device-local PUSH notifications preference (enable/disable).
 *
 *  A single persisted boolean gating whether this device registers its push
 *  token with the daemon. The auto-registration path (`registerPushWithDaemon`,
 *  called on client-ready / account switch) consults `isPushEnabled()` and
 *  no-ops when the user has turned push OFF, so disabling stops the device
 *  from re-registering its token. Default is ON (push works out of the box,
 *  matching prior behaviour).
 *
 *  Built on the shared lib/persistedStore.ts value-store factory; the in-memory
 *  mirror lets the registration path read synchronously after a one-time load,
 *  and the pub/sub repaints the Settings toggle the instant it flips. */

import { createValueStore } from './persistedStore';

const STORAGE_KEY = 'push.enabled';

/** Stored as '1' / '0'. Missing or unrecognised -> default ON. The historical
 *  loader also treated the legacy string 'false' as off. */
const store = createValueStore<boolean>({
  key: STORAGE_KEY,
  default: true,
  serialize: (v) => (v ? '1' : '0'),
  deserialize: (raw) => (raw === '0' || raw === 'false' ? false : true),
  alwaysNotify: true,
});

/** Read the persisted preference once and cache it. Subsequent calls return the
 *  cached value without touching storage. Missing -> enabled (default ON). */
export const loadPushEnabled = (): Promise<boolean> => store.load();

/** Synchronous read from the in-memory cache. Returns the default (true) until
 *  `loadPushEnabled` has run. */
export const isPushEnabledSync = (): boolean => store.get();

/** Persist + apply a new preference, update the cache, and notify subscribers. */
export const setPushEnabled = (enabled: boolean): Promise<void> => store.setAsync(enabled);

/** Subscribe to preference changes. Returns an unsubscribe fn. */
export const subscribePushPref = (cb: () => void): () => void => store.subscribe(cb);
