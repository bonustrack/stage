
import { useCallback, useSyncExternalStore } from 'react';

export function useStoreValue<T>(
  subscribe: (cb: () => void) => () => void,
  get: () => T,
  prime?: () => void,
): T {
  const subscribeAndPrime = useCallback((cb: () => void): (() => void) => {
    prime?.();
    return subscribe(cb);
  }, [subscribe, prime]);
  return useSyncExternalStore(subscribeAndPrime, get, get);
}

export function makeListeners<T = void>(): {
  notify: (v: T) => void;
  subscribe: (cb: (v: T) => void) => () => void;
} {
  const listeners = new Set<(v: T) => void>();
  const notify = (v: T): void => {
    for (const cb of listeners) {
      try { cb(v); } catch { }
    }
  };
  const subscribe = (cb: (v: T) => void): (() => void) => {
    listeners.add(cb);
    return () => { listeners.delete(cb); };
  };
  return { notify, subscribe };
}

export function hydrateOnce<T>(reader: () => Promise<T>): {
  run: () => Promise<T>;
  done: () => boolean;
  markDone: () => void;
  reset: () => void;
} {
  let loaded = false;
  let inFlight: Promise<T> | null = null;
  return {
    run(): Promise<T> {
      if (inFlight) return inFlight;
      inFlight = (async (): Promise<T> => {
        try { return await reader(); }
        finally { loaded = true; inFlight = null; }
      })();
      return inFlight;
    },
    done: (): boolean => loaded,
    markDone(): void { loaded = true; inFlight = null; },
    reset(): void { loaded = false; inFlight = null; },
  };
}
