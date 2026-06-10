/** App Lock — device-local "require biometric / device credential to open the
 *  app" preference + the auth helper that backs both the lock screen and the
 *  key-backup reveal flow.
 *
 *  The preference is a single persisted boolean (default OFF) built on the
 *  shared createValueStore factory, mirroring lib/onboardingSeen. The root
 *  layout reads it through useAppLockGate to decide whether to render the lock
 *  screen over the app on cold start + on a foreground resume after the app has
 *  been backgrounded longer than BACKGROUND_GRACE_MS.
 *
 *  Authentication goes through expo-local-authentication (a NATIVE module — see
 *  the dynamic require below): it prompts Face ID / Touch ID / fingerprint and
 *  falls back to the device passcode/PIN/pattern. If the native module is not
 *  present in the running binary (JS-only OTA before an APK rebuild) the require
 *  throws and authenticate() reports `unavailable` so the gate fails OPEN — the
 *  app must never be permanently locked out by a missing native module. */

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { createValueStore } from './persistedStore';

const STORAGE_KEY = 'app.lock.enabled';

/** A resume after this much background time re-arms the lock. Short taps away
 *  (notification shade, quick app switch) under the grace window do NOT relock,
 *  so the lock stays unobtrusive. */
export const BACKGROUND_GRACE_MS = 30_000;

/** Stored as '1' / '0'. Missing / unrecognised → default OFF. */
const store = createValueStore<boolean>({
  key: STORAGE_KEY,
  default: false,
  serialize: (v) => (v ? '1' : '0'),
  deserialize: (raw) => raw === '1' || raw === 'true',
  alwaysNotify: true,
});

let hasLoaded = false;
const readyListeners = new Set<() => void>();
function notifyReady(): void {
  for (const cb of readyListeners) {
    try { cb(); } catch { /* a bad subscriber shouldn't break the rest */ }
  }
}
const isLoadedSync = (): boolean => hasLoaded;
const subscribe = (cb: () => void): (() => void) => {
  readyListeners.add(cb);
  const unsub = store.subscribe(cb);
  return () => { readyListeners.delete(cb); unsub(); };
};
const loadEnabled = async (): Promise<boolean> => {
  const v = await store.load();
  if (!hasLoaded) { hasLoaded = true; notifyReady(); }
  return v;
};
const loadEnabledAsync = (): void => { void loadEnabled(); };
const isEnabledSync = (): boolean => store.get();

/** Persist the App Lock preference. */
export const setAppLockEnabled = (enabled: boolean): Promise<void> => store.setAsync(enabled);

/** Lazily resolve expo-local-authentication. Returns null when the native
 *  module is absent from the running binary (require throws) so callers can
 *  degrade gracefully instead of crashing. */
/** Minimal hand-written surface of expo-local-authentication. We DON'T
 *  `import type` from the package so this module type-checks even before the
 *  native dep is installed (it's added to package.json + the config plugin; CI /
 *  EAS install it, and it only functions in a native build anyway). */
interface LocalAuth {
  hasHardwareAsync: () => Promise<boolean>;
  isEnrolledAsync: () => Promise<boolean>;
  getEnrolledLevelAsync: () => Promise<number>;
  SecurityLevel: { NONE: number };
  authenticateAsync: (opts: {
    promptMessage?: string;
    disableDeviceFallback?: boolean;
    cancelLabel?: string;
  }) => Promise<{ success: boolean }>;
}
function getLocalAuth(): LocalAuth | null {
  try {
    return require('expo-local-authentication') as LocalAuth;
  } catch {
    return null;
  }
}

export type AuthResult =
  /** User passed biometric / device-credential auth. */
  | { ok: true }
  /** User cancelled or failed the prompt. */
  | { ok: false; reason: 'cancelled' }
  /** No native module, or device has no biometrics AND no passcode enrolled —
   *  callers decide whether to fail open (lock gate) or block (key reveal). */
  | { ok: false; reason: 'unavailable' };

/** Whether the device can authenticate the user at all (native module present
 *  AND some credential — biometric or device passcode — is enrolled). */
export async function canAuthenticate(): Promise<boolean> {
  const LA = getLocalAuth();
  if (!LA) return false;
  try {
    const hasHardware = await LA.hasHardwareAsync();
    const enrolled = await LA.isEnrolledAsync();
    // securityLevel > NONE means a device passcode/PIN exists even without
    // biometric hardware, which DEVICE_CREDENTIAL fallback can use.
    const level = await LA.getEnrolledLevelAsync().catch(() => LA.SecurityLevel.NONE);
    return (hasHardware && enrolled) || level !== LA.SecurityLevel.NONE;
  } catch {
    return false;
  }
}

/** Prompt the user for biometric / device-credential auth. */
export async function authenticate(promptMessage: string): Promise<AuthResult> {
  const LA = getLocalAuth();
  if (!LA) return { ok: false, reason: 'unavailable' };
  try {
    if (!(await canAuthenticate())) return { ok: false, reason: 'unavailable' };
    const res = await LA.authenticateAsync({
      promptMessage,
      // Let the OS fall back to the device PIN/passcode/pattern so a user
      // without biometrics enrolled can still unlock.
      disableDeviceFallback: false,
      cancelLabel: 'Cancel',
    });
    return res.success ? { ok: true } : { ok: false, reason: 'cancelled' };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}

export interface AppLockGate {
  /** False until the persisted flag's one-time load has resolved. */
  ready: boolean;
  /** Whether App Lock is enabled. */
  enabled: boolean;
}

/** Root-layout gate: kicks the one-time load and reactively exposes
 *  ready/enabled. Mirrors useOnboardingGate so the layout stays thin. */
export function useAppLockGate(): AppLockGate {
  useEffect(() => { loadEnabledAsync(); }, []);
  const enabled = useSyncExternalStore(subscribe, isEnabledSync);
  const ready = useSyncExternalStore(subscribe, isLoadedSync);
  return { ready, enabled };
}

/** Reactive read of the App Lock preference for settings screens. */
export function useAppLockEnabled(): boolean {
  useEffect(() => { loadEnabledAsync(); }, []);
  return useSyncExternalStore(subscribe, isEnabledSync);
}

/** Imperative sync read (e.g. for AppState resume logic). */
export const isAppLockEnabledSync = (): boolean => store.get();

/** Toggle the preference. Returns a callback bound to a target value. */
export function useSetAppLock(): (enabled: boolean) => void {
  return useCallback((enabled: boolean) => { void setAppLockEnabled(enabled); }, []);
}
