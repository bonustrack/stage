
import { useCallback, useSyncExternalStore } from 'react';
import { report } from './errorPolicy';

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
      try {
        cb(v);
      } catch (err) {
        report('store.listener', err);
      }
    }
  };
  const subscribe = (cb: (v: T) => void): (() => void) => {
    listeners.add(cb);
    return () => { listeners.delete(cb); };
  };
  return { notify, subscribe, size: () => listeners.size };
}

export function makeValue<T>(initial: T): { get: () => T; set: (next: T) => void; use: () => T } {
  let value = initial;
  const { notify, subscribe } = makeListeners();
  const get = (): T => value;
  return {
    get,
    set: (next) => {
      value = next;
      notify();
    },
    use: () => useStoreValue(subscribe, get),
  };
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
