
import { useStoreValue } from '../storeCore';
import { appStorage } from '../../platform/storage';

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
    const raw = await appStorage.get(STORAGE_KEY);
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
    await appStorage.set(STORAGE_KEY, enabled ? '1' : '0');
  } catch { }
}

export function subscribeDebugConsole(cb: () => void): () => void {
  subscribers.add(cb);
  return () => { subscribers.delete(cb); };
}

function primeDebugConsole(): void { void loadDebugConsole(); }

export function useDebugConsole(): boolean {
  return useStoreValue(subscribeDebugConsole, isDebugConsoleEnabled, primeDebugConsole);
}
