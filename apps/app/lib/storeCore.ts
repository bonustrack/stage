/**
 * @file Shared cross-cutting plumbing for the app's two persisted-store abstractions (PersistentStore in cache.ts and createSetStore/createValueStore in persistedStore.ts): isolating pub/sub fan-out and hydrate-ONCE-without-racing.
 *  Backends stay un-unified on purpose (cache.ts mirrors large JSON to expo-file-system, persistedStore.ts keeps small prefs in AsyncStorage); only the shared plumbing lives here.
 */

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

/**
 * Hydrate-ONCE guard. Wraps an async `reader` so the underlying backend read
 *  runs at most once and concurrent boot callers await the SAME in-flight read
 *  rather than racing (the bug cache.ts hit: a second caller arriving mid-read
 *  saw `loaded === true` with a still-null value). The done flag is set only
 *  AFTER the read resolves; the in-flight promise is memoized until it settles.
 *
 *  `run()` returns the reader's result; `done()` reports whether a read has
 *  completed (sync fast-path callers); `markDone()` short-circuits a pending read
 *  when a `set()` has already supplied the authoritative value; `reset()` clears
 *  both so a fresh account re-hydrates from a clean slate.
 */
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
