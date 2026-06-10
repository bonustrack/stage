/** Device-local "post-onboarding activation has been seen" flag + the one-shot
 *  signal that drives the starter-DM auto-open.
 *
 *  ACTIVATION MOMENT (Stage #9): right after the first-launch onboarding
 *  carousel ("Get started" -> onboarding.seen) a brand-new user would otherwise
 *  land on empty tabs. Instead we show ONE more minimal full-screen gate - the
 *  identity moment (stamp avatar + resolved name) with a single "Continue"
 *  button - and then drop the user straight INTO a DM with the Tony daemon
 *  agent (composer pre-filled with a suggested "hi"). Tony's daemon greets when
 *  messaged, so nothing fake is seeded.
 *
 *  Two pieces, same JS session:
 *    1. `activation.seen`  - persisted boolean (mirrors lib/onboardingSeen). The
 *       root gate renders <Activation/> until it flips true. Default FALSE so a
 *       clean install shows it exactly once; returning users (true) are
 *       unaffected. The "Replay onboarding" testing reset clears it too.
 *    2. `pendingStarterDm` - an in-memory one-shot. The identity screen is a
 *       GATE rendered BEFORE the navigation Stack, so it can't `router.push`.
 *       On "Continue" it stashes the freshly-created DM conv id here and flips
 *       the flag; once the Stack mounts, `useStarterDmOpen()` consumes the
 *       signal and navigates into the conversation. In-memory is sufficient -
 *       the gate->Stack transition never leaves the JS runtime. */

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { router } from 'expo-router';
import { createValueStore } from './persistedStore';

const STORAGE_KEY = 'activation.seen';

/** Stored as '1' / '0'. Missing or unrecognised -> default OFF (not seen). */
const store = createValueStore<boolean>({
  key: STORAGE_KEY,
  default: false,
  serialize: (v) => (v ? '1' : '0'),
  deserialize: (raw) => raw === '1' || raw === 'true',
  alwaysNotify: true,
});

/** Has the one-time load resolved (gate must wait so a returning user with the
 *  flag persisted true never flashes the activation screen for a frame). */
let hasLoaded = false;
const readyListeners = new Set<() => void>();
function notifyReady(): void {
  for (const cb of readyListeners) {
    try { cb(); } catch { /* a bad subscriber shouldn't break the rest */ }
  }
}

const isActivationLoadedSync = (): boolean => hasLoaded;

const subscribeActivation = (cb: () => void): (() => void) => {
  readyListeners.add(cb);
  const unsubValue = store.subscribe(cb);
  return () => { readyListeners.delete(cb); unsubValue(); };
};

const loadActivationSeen = async (): Promise<boolean> => {
  const v = await store.load();
  if (!hasLoaded) { hasLoaded = true; notifyReady(); }
  return v;
};

const loadActivationSeenAsync = (): void => { void loadActivationSeen(); };

const isActivationSeenSync = (): boolean => store.get();

/** Persist that the activation moment has been seen. */
export const setActivationSeen = (seen: boolean): Promise<void> => store.setAsync(seen);

/** One-shot conv id to auto-open after the gate hands off to the Stack. */
let pendingStarterDm: string | null = null;

/** Stash the starter-DM conv id for the Stack to consume on mount. */
export function setPendingStarterDm(convId: string): void { pendingStarterDm = convId; }

/** Consume (read + clear) the pending starter-DM conv id. */
function takePendingStarterDm(): string | null {
  const id = pendingStarterDm;
  pendingStarterDm = null;
  return id;
}

export interface ActivationGate {
  /** False until the persisted flag's one-time load resolved (render the boot
   *  spinner, not the activation screen, while false). */
  ready: boolean;
  /** Whether the activation moment has been completed. */
  seen: boolean;
  /** Mark activation complete and enter the app. */
  finish: () => void;
}

/** Root-layout gate: kicks the one-time load on mount and reactively exposes
 *  ready/seen + a finish callback. Symmetric with useOnboardingGate. */
export function useActivationGate(): ActivationGate {
  useEffect(() => { loadActivationSeenAsync(); }, []);
  const seen = useSyncExternalStore(subscribeActivation, isActivationSeenSync);
  const ready = useSyncExternalStore(subscribeActivation, isActivationLoadedSync);
  const finish = useCallback(() => { void setActivationSeen(true); }, []);
  return { ready, seen, finish };
}

/** Mounted inside the navigation Stack: once it's up, consume the one-shot and
 *  navigate into the freshly-created starter DM. No-op for returning users (the
 *  signal is only ever set by the activation gate's Continue). */
export function useStarterDmOpen(): void {
  useEffect(() => {
    const convId = takePendingStarterDm();
    if (!convId) return;
    router.push({ pathname: '/xmtp/[convId]', params: { convId } });
  }, []);
}
