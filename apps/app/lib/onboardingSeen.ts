/** Device-local "has the first-launch onboarding been seen" flag.
 *
 *  A single persisted boolean that gates the full-screen onboarding carousel
 *  shown on the very first app launch. The root layout (app/_layout.tsx) reads
 *  it once at boot (after assets/fonts load) and, when it's still false, renders
 *  the Onboarding flow INSTEAD of the main app until the user taps "Get
 *  started" - at which point we flip it to true and let them into the app.
 *
 *  Default is FALSE so a clean install shows onboarding exactly once; every
 *  subsequent launch reads `true` and goes straight into the app. The
 *  Experimental settings page exposes a "Replay onboarding" row that resets this
 *  to false (for testing the flow again).
 *
 *  Built on the shared lib/persistedStore.ts value-store factory; the in-memory
 *  mirror lets the gate read synchronously after a one-time load, and the pub/sub
 *  repaints the gate the instant the flag flips. */

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { createValueStore } from './persistedStore';

const STORAGE_KEY = 'onboarding.seen';

/** Stored as '1' / '0'. Missing or unrecognised -> default OFF (not seen). */
const store = createValueStore<boolean>({
  key: STORAGE_KEY,
  default: false,
  serialize: (v) => (v ? '1' : '0'),
  deserialize: (raw) => raw === '1' || raw === 'true',
  alwaysNotify: true,
});

/** Whether the one-time load from AsyncStorage has resolved. The gate must wait
 *  for this before deciding - otherwise a returning user (flag persisted true)
 *  would flash the onboarding for one frame while the default (false) is still
 *  in the in-memory mirror. We mirror the same listener set so a single
 *  subscription repaints on BOTH "load resolved" and later "flag flipped". */
let hasLoaded = false;
const readyListeners = new Set<() => void>();
function notifyReady(): void {
  for (const cb of readyListeners) {
    try { cb(); } catch { /* a bad subscriber shouldn't break the rest */ }
  }
}

/** Synchronous read: has the persisted flag finished loading at least once. */
export const isOnboardingLoadedSync = (): boolean => hasLoaded;

/** Subscribe to BOTH the load-resolved transition and flag changes. */
export const subscribeOnboarding = (cb: () => void): () => void => {
  readyListeners.add(cb);
  const unsubValue = store.subscribe(cb);
  return () => { readyListeners.delete(cb); unsubValue(); };
};

/** Await the one-time load and get whether onboarding has been seen. Flips the
 *  load-resolved flag + notifies ready subscribers when it lands. */
export const loadOnboardingSeen = async (): Promise<boolean> => {
  const v = await store.load();
  if (!hasLoaded) { hasLoaded = true; notifyReady(); }
  return v;
};

/** Fire-and-forget the one-time load; notifies subscribers (value + ready) when
 *  it lands. */
export const loadOnboardingSeenAsync = (): void => { void loadOnboardingSeen(); };

/** Synchronous read from the in-memory cache (false until loaded). */
export const isOnboardingSeenSync = (): boolean => store.get();

/** Persist that onboarding has been seen and notify subscribers. */
export const setOnboardingSeen = (seen: boolean): Promise<void> => store.setAsync(seen);

/** Subscribe to changes. Returns an unsubscribe fn. */
export const subscribeOnboardingSeen = (cb: () => void): () => void => store.subscribe(cb);

export interface OnboardingGate {
  /** False until the persisted flag's one-time load has resolved - the gate
   *  should render the boot spinner (not onboarding) while this is false. */
  ready: boolean;
  /** Whether onboarding has been completed (true -> let the user into the app). */
  seen: boolean;
  /** Mark onboarding complete and enter the app. */
  finish: () => void;
}

/** Root-layout gate: kicks the one-time load on mount and reactively exposes
 *  ready/seen + a finish callback. Keeps app/_layout.tsx thin (one hook call,
 *  one early return). */
export function useOnboardingGate(): OnboardingGate {
  useEffect(() => { loadOnboardingSeenAsync(); }, []);
  const seen = useSyncExternalStore(subscribeOnboarding, isOnboardingSeenSync);
  const ready = useSyncExternalStore(subscribeOnboarding, isOnboardingLoadedSync);
  const finish = useCallback(() => { void setOnboardingSeen(true); }, []);
  return { ready, seen, finish };
}
