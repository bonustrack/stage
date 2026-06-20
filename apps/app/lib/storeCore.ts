/** @file Shared plumbing (pub/sub fan-out + hydrate-once-without-racing) for the two persisted-store abstractions; backends stay separate (cache.ts mirrors JSON to expo-file-system, persistedStore.ts keeps prefs in AsyncStorage). */

/** A pub/sub listener set + a `notify` that isolates subscriber throws (a bad callback can't break the rest of the fan-out). `T` is the value passed to each listener (`void` for the zero-arg style persistedStore uses). */
export function makeListeners<T = void>(): {
  listeners: Set<(v: T) => void>;
  notify: (v: T) => void;
} {
  const listeners = new Set<(v: T) => void>();
  /** Notify helper. */
  const notify = (v: T): void => {
    for (const cb of listeners) {
      try { cb(v); } catch { /* a bad subscriber shouldn't break the rest */ }
    }
  };
  return { listeners, notify };
}

/** Hydrate-once guard wrapping an async `reader` so the backend read runs at most once and concurrent callers await the same in-flight read (done set only after it resolves); `run`/`done`/`markDone`/`reset` cover read, sync-check, set()-short-circuit, and clean-slate re-hydration. */
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
