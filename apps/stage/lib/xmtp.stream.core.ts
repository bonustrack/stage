import { AccountChangedError, NoAccountError } from './xmtp.client.core';

interface StreamDeps<C> {
  prepare: (assertCurrent: () => void) => Promise<C>;
  current: (context: C) => boolean;
  open: (context: C, current: () => boolean, closed: () => void) => Promise<() => void>;
  wanted: () => boolean;
  live: () => void;
  closed: () => void;
  stopped: () => void;
  report: (error: unknown) => void;
  schedule: (run: () => void, delay: number) => () => void;
}

export function makeGlobalStream<C>(deps: StreamDeps<C>) {
  let cancel: (() => void) | null = null;
  let timer: (() => void) | null = null;
  let starting = false;
  let generation = 0;
  let failures = 0;

  function rearm(delay = 500): void {
    if (timer || !deps.wanted()) return;
    timer = deps.schedule(() => { timer = null; void ensure(); }, delay);
  }

  function retry(error: unknown, stale: boolean): void {
    const changed = error instanceof AccountChangedError;
    const absent = error instanceof NoAccountError;
    if (!changed && !absent) deps.report(error);
    if (stale || changed) rearm();
    else if (!absent) { failures += 1; rearm(Math.min(5_000 * 2 ** (failures - 1), 60_000)); }
  }

  async function ensure(): Promise<void> {
    if (cancel || starting || !deps.wanted()) return;
    starting = true;
    const startedIn = generation;
    const assertCurrent = (): void => { if (startedIn !== generation) throw new AccountChangedError(); };
    try {
      const context = await deps.prepare(assertCurrent);
      assertCurrent();
      let closed = false;
      const current = (): boolean => !closed && startedIn === generation && deps.current(context);
      const onClose = (): void => {
        if (!current()) return;
        closed = true;
        const stop = cancel;
        cancel = null;
        stop?.();
        deps.closed();
        rearm();
      };
      const stop = await deps.open(context, current, onClose);
      if (!current()) { stop(); rearm(); return; }
      cancel = () => { closed = true; stop(); };
      failures = 0;
      deps.live();
    } catch (error) {
      retry(error, startedIn !== generation);
    } finally {
      starting = false;
    }
  }

  function teardown(): void {
    generation += 1;
    const stop = cancel;
    cancel = null;
    stop?.();
    timer?.();
    timer = null;
    failures = 0;
    deps.stopped();
  }

  return { ensure, teardown, rearm, live: () => cancel !== null };
}
