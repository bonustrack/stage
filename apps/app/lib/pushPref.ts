/** Device-local PUSH notifications preference (enable/disable).
 *
 *  A single persisted boolean gating whether this device registers its push
 *  token with the daemon. The auto-registration path (`registerPushWithDaemon`,
 *  called on client-ready / account switch) consults `isPushEnabled()` and
 *  no-ops when the user has turned push OFF — so disabling stops the device
 *  from re-registering its token. Default is ON (push works out of the box,
 *  matching prior behaviour).
 *
 *  Dependency-free pub/sub (same shape as lib/pins.ts) so the Settings toggle
 *  re-renders the instant the preference flips, and an in-memory cache so the
 *  registration path can read it synchronously after a one-time load. */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'push.enabled';

/** In-memory mirror. Defaults to enabled until the persisted value loads. */
let cache = true;
let loaded = false;

const subscribers = new Set<() => void>();

function notify(): void {
  for (const cb of subscribers) {
    try { cb(); } catch { /* a bad subscriber shouldn't break the rest */ }
  }
}

/** Read the persisted preference once and cache it. Subsequent calls return the
 *  cached value without touching storage. Missing → enabled (default ON). */
export async function loadPushEnabled(): Promise<boolean> {
  if (loaded) return cache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw === '0' || raw === 'false') cache = false;
    else cache = true;
  } catch { /* corrupt/missing → default ON */ }
  loaded = true;
  return cache;
}

/** Synchronous read from the in-memory cache. Returns the default (true) until
 *  `loadPushEnabled` has run. */
export function isPushEnabledSync(): boolean {
  return cache;
}

/** Persist + apply a new preference, update the cache, and notify subscribers. */
export async function setPushEnabled(enabled: boolean): Promise<void> {
  cache = enabled;
  loaded = true;
  notify();
  try {
    await AsyncStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch { /* best-effort — the in-memory cache still reflects the toggle */ }
}

/** Subscribe to preference changes. Returns an unsubscribe fn. */
export function subscribePushPref(cb: () => void): () => void {
  subscribers.add(cb);
  return () => { subscribers.delete(cb); };
}
