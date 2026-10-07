import { AccountChangedError, NoAccountError } from './xmtp.client.core';
import { abortable } from './abortable.core';

interface StreamDeps<C> {
  prepare: (assertCurrent: () => void) => Promise<C>;
  current: (context: C) => boolean;
  open: (context: C, current: () => boolean, closed: () => void, signal: AbortSignal) => Promise<() => void>;
  wanted: () => boolean;
  live: () => void;
  closed: () => void;
  stopped: () => void;
  report: (error: unknown) => void;
  schedule: (run: () => void, delay: number) => () => void;
}

interface AccountStreams {
  messages: () => Promise<() => void>;
  preferences: (onChange: () => void) => Promise<() => void>;
  deletions: () => () => void;
  refreshPush: () => void;
  current: () => boolean;
  signal: AbortSignal;
}

export async function openAccountStreams(deps: AccountStreams): Promise<() => void> {
  const stop = await abortable(deps.messages(), deps.signal, late => { late(); });
  if (!deps.current()) return stop;
  let stopPreferences: (() => void) | undefined;
  try {
    const refreshPush = (): void => { if (deps.current()) deps.refreshPush(); };
    stopPreferences = await abortable(deps.preferences(refreshPush), deps.signal, late => { late(); });
    if (!deps.current()) return () => { stop(); stopPreferences?.(); };
    refreshPush();
    const stopDeletions = deps.deletions();
    return () => { stop(); stopPreferences?.(); stopDeletions(); };
  } catch (error) {
    stop();
    stopPreferences?.();
    throw error;
  }
}

export function makeGlobalStream<C>(deps: StreamDeps<C>) {
  let cancel: (() => void) | null = null;
  let timer: (() => void) | null = null;
  let starting = false;
  let startup: AbortController | null = null;
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

  function reportLate(error: unknown): void {
    if (!(error instanceof AccountChangedError) && !(error instanceof NoAccountError)) deps.report(error);
  }

  async function ensure(): Promise<void> {
    if (cancel || starting || !deps.wanted()) return;
    starting = true;
    const controller = new AbortController();
    startup = controller;
    const startedIn = generation;
    const assertCurrent = (): void => { if (startedIn !== generation) throw new AccountChangedError(); };
    try {
      const context = await abortable(deps.prepare(assertCurrent), controller.signal, undefined, reportLate);
      assertCurrent();
      let closed = false;
      const current = (): boolean => !closed && startedIn === generation && deps.current(context);
      const onClose = (): void => {
        if (!current()) return;
        closed = true;
        controller.abort(new AccountChangedError());
        const stop = cancel;
        cancel = null;
        stop?.();
        deps.closed();
        rearm();
      };
      const stop = await abortable(deps.open(context, current, onClose, controller.signal), controller.signal, late => { late(); });
      if (!current()) { stop(); rearm(); return; }
      cancel = () => { closed = true; stop(); };
      failures = 0;
      deps.live();
    } catch (error) {
      retry(error, startedIn !== generation);
    } finally {
      if (startup === controller) startup = null;
      starting = false;
    }
  }

  function teardown(): void {
    generation += 1;
    startup?.abort(new AccountChangedError());
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
