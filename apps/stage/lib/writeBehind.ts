export interface KeyedTimers {
  schedule: (key: string, delayMs: number, run: () => void) => void;
  cancel: (key: string) => boolean;
  has: (key: string) => boolean;
}

export function keyedTimers(): KeyedTimers {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const cancel = (key: string): boolean => {
    const timer = timers.get(key);
    if (timer === undefined) return false;
    clearTimeout(timer);
    timers.delete(key);
    return true;
  };
  return {
    schedule(key, delayMs, run) {
      cancel(key);
      timers.set(
        key,
        setTimeout(() => {
          timers.delete(key);
          run();
        }, delayMs),
      );
    },
    cancel,
    has: (key) => timers.has(key),
  };
}

export interface WritePolicy {
  delayMs: number;
  restart?: boolean;
  maxWaitMs?: number;
}

export interface WriteBehind<V> {
  set: (key: string, value: V) => void;
  peek: (key: string) => { value: V } | undefined;
  flush: (key: string) => boolean;
  flushAll: () => void;
  drop: (key: string) => void;
}

export function writeBehind<V>(policy: WritePolicy, write: (key: string, value: V) => void): WriteBehind<V> {
  const pending = new Map<string, { value: V }>();
  const timers = keyedTimers();
  const forcedAt = new Map<string, number>();
  function flush(key: string): boolean {
    timers.cancel(key);
    const next = pending.get(key);
    if (next === undefined) return false;
    pending.delete(key);
    write(key, next.value);
    return true;
  }
  function forced(key: string): boolean {
    if (policy.maxWaitMs === undefined) return false;
    const now = Date.now();
    if (now - (forcedAt.get(key) ?? 0) < policy.maxWaitMs) return false;
    forcedAt.set(key, now);
    return true;
  }
  return {
    set(key, value) {
      pending.set(key, { value });
      if (policy.restart !== false || !timers.has(key)) {
        timers.schedule(key, policy.delayMs, () => {
          flush(key);
        });
      }
      if (forced(key)) flush(key);
    },
    peek: (key) => pending.get(key),
    flush,
    flushAll() {
      for (const key of [...pending.keys()]) flush(key);
    },
    drop(key) {
      timers.cancel(key);
      pending.delete(key);
    },
  };
}
