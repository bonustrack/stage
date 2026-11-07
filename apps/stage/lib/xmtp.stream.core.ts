import { AccountChangedError, NoAccountError } from './accountSelection';
import { abortable } from '@stage-labs/client/abortable';
import { backoffDelay } from '@stage-labs/client/timing';

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

function stopLate(stop: () => void): void {
  stop();
}

export async function openAccountStreams(deps: AccountStreams): Promise<() => void> {
  const stops = [await abortable(deps.messages(), deps.signal, stopLate)];
  const stopAll = (): void => {
    for (const stop of stops) stop();
  };
  if (!deps.current()) return stopAll;
  try {
    const refreshPush = (): void => {
      if (deps.current()) deps.refreshPush();
    };
    stops.push(await abortable(deps.preferences(refreshPush), deps.signal, stopLate));
    if (!deps.current()) return stopAll;
    refreshPush();
    stops.push(deps.deletions());
    return stopAll;
  } catch (error) {
    stopAll();
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
    timer = deps.schedule(() => {
      timer = null;
      void ensure();
    }, delay);
  }

  function retry(error: unknown, stale: boolean): void {
    const changed = error instanceof AccountChangedError;
    const absent = error instanceof NoAccountError;
    if (!changed && !absent) deps.report(error);
    if (stale || changed) rearm();
    else if (!absent) {
      failures += 1;
      rearm(backoffDelay(failures));
    }
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
    const assertCurrent = (): void => {
      if (startedIn !== generation) throw new AccountChangedError();
    };
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
      const stop = await abortable(deps.open(context, current, onClose, controller.signal), controller.signal, stopLate);
      if (!current()) {
        stop();
        rearm();
        return;
      }
      cancel = () => {
        closed = true;
        stop();
      };
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
