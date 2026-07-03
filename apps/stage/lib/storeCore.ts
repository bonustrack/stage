
export function makeListeners<T = void>(): {
  listeners: Set<(v: T) => void>;
  notify: (v: T) => void;
} {
  const listeners = new Set<(v: T) => void>();
  const notify = (v: T): void => {
    for (const cb of listeners) {
      try { cb(v); } catch { }
    }
  };
  return { listeners, notify };
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
