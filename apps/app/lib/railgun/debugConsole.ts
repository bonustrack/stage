
import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'railgun.debugConsole.enabled';

let cache = false;
let loaded = false;

const subscribers = new Set<() => void>();

function notify(): void {
  for (const cb of subscribers) {
    try { cb(); } catch { }
  }
}

export async function loadDebugConsole(): Promise<boolean> {
  if (loaded) return cache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    cache = raw === '1' || raw === 'true';
  } catch { }
  loaded = true;
  notify();
  return cache;
}

export function isDebugConsoleEnabled(): boolean {
  return cache;
}

export async function setDebugConsole(enabled: boolean): Promise<void> {
  cache = enabled;
  loaded = true;
  notify();
  try {
    await AsyncStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch { }
}

export function subscribeDebugConsole(cb: () => void): () => void {
  subscribers.add(cb);
  return () => { subscribers.delete(cb); };
}

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
