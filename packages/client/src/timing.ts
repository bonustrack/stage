export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function settleBy<T>(work: Promise<T>, deadline: number, fallback: T, tickMs = 1_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<T>((resolve) => {
    const check = (): void => {
      const left = deadline - Date.now();
      if (left <= 0) {
        resolve(fallback);
        return;
      }
      timer = setTimeout(check, Math.min(tickMs, left));
    };
    check();
  });
  return Promise.race([work, expired]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}

export function settleWithin<T>(work: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      resolve(fallback);
    }, ms);
  });
  return Promise.race([work, expired]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}

export interface Backoff {
  baseMs: number;
  maxMs: number;
}

export const RETRY_BACKOFF: Backoff = { baseMs: 5_000, maxMs: 60_000 };

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
