/** Shared core for the app's two persisted-store abstractions (lib/cache.ts's
 *  PersistentStore and lib/persistedStore.ts's createSetStore/createValueStore).
 *  Both solved the same two problems independently:
 *
 *   1. pub/sub fan-out that never lets one bad subscriber break the rest, and
 *   2. hydrate-ONCE off a backend (file / AsyncStorage) without racing.
 *
 *  This module owns both so the two store flavours stay in sync. Backends are NOT
 *  unified on purpose: cache.ts mirrors large JSON blobs to expo-file-system
 *  (channels list, debounced writes), while persistedStore.ts keeps small prefs
 *  in AsyncStorage. Only the cross-cutting plumbing lives here. */

/** A pub/sub listener set + a `notify` that isolates subscriber throws (a bad
 *  callback can't break the rest of the fan-out). `T` is the value passed to each
 *  listener (`void` for the zero-arg style persistedStore uses). */
export function makeListeners<T = void>(): {
  listeners: Set<(v: T) => void>;
  notify: (v: T) => void;
} {
  const listeners = new Set<(v: T) => void>();
  const notify = (v: T): void => {
    for (const cb of listeners) {
      try { cb(v); } catch { /* a bad subscriber shouldn't break the rest */ }
    }
  };
  return { listeners, notify };
}

/** Hydrate-ONCE guard. Wraps an async `reader` so the underlying backend read
 *  runs at most once and concurrent boot callers await the SAME in-flight read
 *  rather than racing (the bug cache.ts hit: a second caller arriving mid-read
 *  saw `loaded === true` with a still-null value). The done flag is set only
 *  AFTER the read resolves; the in-flight promise is memoized until it settles.
 *
 *  `run()` returns the reader's result; `done()` reports whether a read has
 *  completed (sync fast-path callers); `markDone()` short-circuits a pending read
 *  when a `set()` has already supplied the authoritative value; `reset()` clears
 *  both so a fresh account re-hydrates from a clean slate. */
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
