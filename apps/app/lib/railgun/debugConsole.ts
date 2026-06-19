/** @file Device-local, default-off toggle (pub/sub + AsyncStorage-backed) gating whether the on-screen RAILGUN debug console mounts and subscribes to bridge lifecycle/scan streams. */
/**
 * Device-local toggle for the on-screen RAILGUN debug console.
 *
 *  The Private wallet tab can render two diagnostic blocks: the balance-pipeline
 *  panel (RailgunDebugPanel) and the Node-bridge ping probe (BridgePingProbe).
 *  Both subscribe to the bridge's high-frequency lifecycle + scanDebug streams
 *  and, when shown, append every line into on-screen log state. That streaming
 *  made the phone laggy, so the console is now HIDDEN BY DEFAULT and only mounts
 *  when this flag is ON. When OFF the components do not mount at all, so no
 *  subscription is registered and nothing accumulates. Engine scanning is wired
 *  separately (lib/railgun/balanceWatch + shieldScan) and is unaffected.
 *
 *  Dependency-free pub/sub + in-memory cache (same shape as lib/pushPref.ts) so
 *  the Settings toggle and the Private view repaint the instant it flips, and the
 *  gate can be read synchronously after a one-time load. Default OFF.
 */

import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'railgun.debugConsole.enabled';

/** In-memory mirror. Defaults to OFF until the persisted value loads. */
let cache = false;
let loaded = false;

const subscribers = new Set<() => void>();

/** Notify helper. */
function notify(): void {
  for (const cb of subscribers) {
    try { cb(); } catch { /* a bad subscriber shouldn't break the rest */ }
  }
}

/** Read the persisted preference once and cache it. Subsequent calls return the cached value without touching storage. Missing → OFF (default). */
export async function loadDebugConsole(): Promise<boolean> {
  if (loaded) return cache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    cache = raw === '1' || raw === 'true';
  } catch { /* corrupt/missing → default OFF */ }
  loaded = true;
  notify();
  return cache;
}

/** Synchronous read from the in-memory cache. Returns the default (false) until `loadDebugConsole` has run. */
export function isDebugConsoleEnabled(): boolean {
  return cache;
}

/** Persist + apply a new preference, update the cache, and notify subscribers. */
export async function setDebugConsole(enabled: boolean): Promise<void> {
  cache = enabled;
  loaded = true;
  notify();
  try {
    await AsyncStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch { /* best-effort - the in-memory cache still reflects the toggle */ }
}

/** Subscribe to preference changes. Returns an unsubscribe fn. */
export function subscribeDebugConsole(cb: () => void): () => void {
  subscribers.add(cb);
  return () => { subscribers.delete(cb); };
}

/** React hook: reactive read of the gate. Kicks off the one-time load on mount so a fresh process reflects the persisted value, then re-renders on flips. */
export function useDebugConsole(): boolean {
  return useSyncExternalStore(
    (cb) => {
      void loadDebugConsole();
      return subscribeDebugConsole(cb);
    },
    isDebugConsoleEnabled,
    isDebugConsoleEnabled,
  );
}
