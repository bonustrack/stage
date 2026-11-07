export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

type Timer = ReturnType<typeof setTimeout>;

type ExpiryClock = (expire: () => void, wait: (ms: number, then: () => void) => void) => void;

function settleOnClock<T>(work: Promise<T>, fallback: T, clock: ExpiryClock): Promise<T> {
  let timer: Timer | undefined;
  const expired = new Promise<T>((resolve) => {
    clock(
      () => {
        resolve(fallback);
      },
      (ms, then) => {
        timer = setTimeout(then, ms);
      },
    );
  });
  return Promise.race([work, expired]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}

export function settleBy<T>(work: Promise<T>, deadline: number, fallback: T, tickMs = 1_000): Promise<T> {
  return settleOnClock(work, fallback, (expire, wait) => {
    const check = (): void => {
      const left = deadline - Date.now();
      if (left <= 0) expire();
      else wait(Math.min(tickMs, left), check);
    };
    check();
  });
}

export function settleWithin<T>(work: Promise<T>, ms: number, fallback: T): Promise<T> {
  return settleOnClock(work, fallback, (expire, wait) => {
    wait(ms, expire);
  });
}

const TIMED_OUT = Symbol('timed out');

export async function rejectAfter<T>(work: Promise<T>, ms: number, timedOut: () => Error, disposeLate?: (value: T) => void): Promise<T> {
  const result = await settleBy<T | typeof TIMED_OUT>(work, Date.now() + ms, TIMED_OUT);
  if (result !== TIMED_OUT) return result;
  if (disposeLate) void work.then(disposeLate, () => undefined);
  throw timedOut();
}

export interface Backoff {
  baseMs: number;
  maxMs: number;
}

const RETRY_BACKOFF: Backoff = { baseMs: 5_000, maxMs: 60_000 };

export function backoffDelay(attempt: number, backoff: Backoff = RETRY_BACKOFF): number {
  return Math.min(backoff.baseMs * 2 ** Math.max(0, attempt - 1), backoff.maxMs);
}

export interface LinkedDeadline {
  signal: AbortSignal;
  release: () => void;
}

export interface DeadlineReasons {
  cancelled?: () => unknown;
  timedOut?: () => unknown;
}

export function linkedDeadline(timeoutMs: number, outer: AbortSignal | undefined, reasons: DeadlineReasons = {}): LinkedDeadline {
  const controller = new AbortController();
  const cancel = (): void => {
    controller.abort(reasons.cancelled?.());
  };
  if (outer?.aborted) cancel();
  else outer?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(() => {
    controller.abort(reasons.timedOut?.());
  }, timeoutMs);
  return {
    signal: controller.signal,
    release: () => {
      clearTimeout(timer);
      outer?.removeEventListener('abort', cancel);
    },
  };
}

export interface FetchDeadline {
  timeoutMs: number;
  signal?: AbortSignal;
}

export class FetchTimeoutError extends Error {
  constructor() {
    super('The request timed out');
    this.name = 'FetchTimeoutError';
  }
}

export async function fetchWithin<T = Response>(
  input: string,
  init: RequestInit,
  deadline: FetchDeadline,
  read: (response: Response) => Promise<T> | T = (response) => response as T,
): Promise<T> {
  let expire: (error: FetchTimeoutError) => void = () => undefined;
  const timedOut = new Promise<never>((_, reject) => {
    expire = reject;
  });
  const linked = linkedDeadline(deadline.timeoutMs, deadline.signal, {
    timedOut: () => {
      expire(new FetchTimeoutError());
      return undefined;
    },
  });
  try {
    const request = fetch(input, { ...init, signal: linked.signal }).then(read);
    return await Promise.race([request, timedOut]);
  } finally {
    linked.release();
  }
}
