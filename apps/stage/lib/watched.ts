export interface Watched<T> {
  get: () => T;
  set: (next: T) => void;
  until: <R>(pick: (value: T) => R | null | undefined | false | '' | 0, timeoutMs: number, timeoutMessage: string) => Promise<R>;
}

export function makeWatched<T>(initial: T): Watched<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (next) => {
      value = next;
      for (const listener of [...listeners]) listener();
    },
    until: (pick, timeoutMs, timeoutMessage) =>
      new Promise((resolve, reject) => {
        const stop = (): void => {
          clearTimeout(timer);
          listeners.delete(check);
        };
        const check = (): void => {
          try {
            const picked = pick(value);
            if (!picked) return;
            stop();
            resolve(picked);
          } catch (err) {
            stop();
            reject(err instanceof Error ? err : new Error(String(err)));
          }
        };
        const timer = setTimeout(() => {
          stop();
          reject(new Error(timeoutMessage));
        }, timeoutMs);
        listeners.add(check);
        check();
      }),
  };
}

export interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: Error) => void;
}

export function makeDeferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: Error) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
