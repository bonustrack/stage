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
  const controller = new AbortController();
  const abort = (): void => {
    controller.abort();
  };
  const { signal } = deadline;
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new FetchTimeoutError());
      abort();
    }, deadline.timeoutMs);
  });
  try {
    const request = fetch(input, { ...init, signal: controller.signal }).then(read);
    return await Promise.race([request, timedOut]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
