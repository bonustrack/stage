
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
  size: () => number;
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
  return { notify, subscribe, size: () => listeners.size };
}

export function makeSharedSource<S, T = void>(
  open: (source: S, emit: (value: T) => void) => () => void,
): (source: S, cb: (value: T) => void) => () => void {
  const listeners = makeListeners<T>();
  let running: { source: S; close: () => void } | null = null;
  const close = (): void => { running?.close(); running = null; };
  return (source, cb) => {
    if (running !== null && running.source !== source) close();
    running ??= { source, close: open(source, (value) => { listeners.notify(value); }) };
    const unsubscribe = listeners.subscribe(cb);
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      unsubscribe();
      if (listeners.size() === 0) close();
    };
  };
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

interface ClientSlot<C> {
  get: () => C | null;
  set: (client: C | null) => void;
  getOrCreate: (create: () => Promise<C>) => Promise<C>;
  waitForReady: (capMs?: number) => Promise<boolean>;
  reset: () => void;
}

export function createClientSlot<C>(onReset: () => void): ClientSlot<C> {
  let cached: C | null = null;
  let inFlight: Promise<C> | null = null;
  return {
    get: () => cached,
    set: (client) => { cached = client; },
    getOrCreate: async (create) => {
      if (cached) return cached;
      if (inFlight) return inFlight;
      const pending = create();
      inFlight = pending;
      try { return await pending; } finally { if (inFlight === pending) inFlight = null; }
    },
    waitForReady: async (capMs = 60_000) => {
      const start = Date.now();
      while (cached === null && Date.now() - start < capMs) await new Promise((r) => setTimeout(r, 250));
      return cached !== null;
    },
    reset: () => {
      cached = null;
      inFlight = null;
      onReset();
    },
  };
}
