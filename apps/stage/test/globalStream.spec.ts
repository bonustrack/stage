import { describe, expect, test } from 'bun:test';
import { AccountChangedError, NoAccountError } from '../lib/xmtp.client.core';
import { makeGlobalStream } from '../lib/xmtp.stream.core';

interface Context { id: string }

function deferred<T>() {
  let resolve: (value: T) => void = () => { throw new Error('Not initialized'); };
  let reject: (error: unknown) => void = () => { throw new Error('Not initialized'); };
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function settle(): Promise<void> {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
}

function harness() {
  const state = { account: 'a' as string | null, wanted: true, live: 0, closed: 0, stopped: 0 };
  const errors: unknown[] = [];
  const messages: string[] = [];
  const timers = new Map<symbol, { run: () => void; delay: number }>();
  const opened: { id: string; emit: () => void; close: () => void; stops: number }[] = [];
  const hooks = {
    prepare: (assertCurrent: () => void): Promise<Context> => {
      assertCurrent();
      return state.account ? Promise.resolve({ id: state.account }) : Promise.reject(new NoAccountError());
    },
    wait: (): Promise<void> => Promise.resolve(),
  };
  const stream = makeGlobalStream({
    prepare: assertCurrent => hooks.prepare(assertCurrent),
    current: (context: Context) => context.id === state.account,
    open: async (context, current, close) => {
      const entry = { id: context.id, emit: () => { if (current()) messages.push(context.id); }, close, stops: 0 };
      opened.push(entry);
      await hooks.wait();
      return () => { entry.stops += 1; close(); };
    },
    wanted: () => state.wanted,
    live: () => { state.live += 1; },
    closed: () => { state.closed += 1; },
    stopped: () => { state.stopped += 1; },
    report: error => { errors.push(error); },
    schedule: (run, delay) => {
      const id = Symbol();
      timers.set(id, { run, delay });
      return () => { timers.delete(id); };
    },
  });
  const fire = async (): Promise<number> => {
    const first = timers.entries().next().value;
    if (!first) throw new Error('No retry scheduled');
    timers.delete(first[0]);
    first[1].run();
    await settle();
    return first[1].delay;
  };
  const restart = (): void => { stream.teardown(); void stream.ensure(); };
  return { state, errors, messages, timers, opened, hooks, stream, fire, restart };
}

describe('global message stream lifecycle', () => {
  test('onboarding is idle, then account activation starts exactly one stream', async () => {
    const h = harness();
    h.state.account = null;
    await h.stream.ensure();
    expect(h.errors).toEqual([]);
    expect(h.timers.size).toBe(0);
    expect(h.opened).toEqual([]);
    h.state.account = 'a';
    h.restart();
    await settle();
    await h.stream.ensure();
    expect(h.opened.map(stream => stream.id)).toEqual(['a']);
    expect(h.stream.live()).toBe(true);
  });

  test('cancellation during preparation restarts promptly without failure backoff', async () => {
    const h = harness();
    const pending = deferred<Context>();
    h.hooks.prepare = async assertCurrent => { const context = await pending.promise; assertCurrent(); return context; };
    const first = h.stream.ensure();
    h.state.account = 'b';
    h.restart();
    pending.resolve({ id: 'a' });
    await first;
    expect(h.errors).toEqual([]);
    expect(h.opened).toEqual([]);
    h.hooks.prepare = () => Promise.resolve({ id: 'b' });
    expect(await h.fire()).toBe(500);
    expect(h.opened.map(stream => stream.id)).toEqual(['b']);
  });

  test('teardown while opening cancels the obsolete handle only once', async () => {
    const h = harness();
    const pending = deferred<undefined>();
    h.hooks.wait = () => pending.promise;
    const first = h.stream.ensure();
    await settle();
    h.stream.teardown();
    pending.resolve(undefined);
    await first;
    await settle();
    expect(h.opened[0]?.stops).toBe(1);
    expect(h.state.closed).toBe(0);
    expect(h.state.live).toBe(0);
    h.hooks.wait = () => Promise.resolve();
    expect(await h.fire()).toBe(500);
    expect(h.opened).toHaveLength(2);
    expect(h.stream.live()).toBe(true);
  });

  test('a closed worker with unresolved startup cannot block the replacement account', async () => {
    const h = harness();
    h.hooks.wait = () => new Promise(() => undefined);
    const first = h.stream.ensure();
    await settle();
    h.state.account = 'b';
    h.restart();
    await first;
    h.hooks.wait = () => Promise.resolve();
    expect(await h.fire()).toBe(500);
    expect(h.opened.map(stream => stream.id)).toEqual(['a', 'b']);
    expect(h.stream.live()).toBe(true);
  });

  test('obsolete message and close callbacks cannot affect the replacement account', async () => {
    const h = harness();
    await h.stream.ensure();
    const old = h.opened[0];
    h.state.account = 'b';
    h.restart();
    await settle();
    old?.emit();
    old?.close();
    h.opened[1]?.emit();
    expect(h.messages).toEqual(['b']);
    expect(h.state.closed).toBe(0);
    expect(h.timers.size).toBe(0);
    expect(h.stream.live()).toBe(true);
    expect(h.opened.map(stream => stream.stops)).toEqual([1, 0]);
  });

  test('real failures still report and back off, even with the former cancellation text', async () => {
    const h = harness();
    const error = new Error('Messaging account changed');
    h.hooks.prepare = () => Promise.reject(error);
    await h.stream.ensure();
    const delays: number[] = [];
    for (let i = 0; i < 6; i += 1) delays.push(await h.fire());
    expect(delays).toEqual([5_000, 10_000, 20_000, 40_000, 60_000, 60_000]);
    expect(h.errors).toEqual(Array.from({ length: 7 }, () => error));
    h.hooks.prepare = () => Promise.resolve({ id: 'a' });
    await h.fire();
    h.opened[0]?.close();
    h.hooks.prepare = () => Promise.reject(error);
    expect(await h.fire()).toBe(500);
    expect([...h.timers.values()].map(timer => timer.delay)).toEqual([5_000]);
  });

  test('a genuine stale failure is reported without penalizing the new account', async () => {
    const h = harness();
    const pending = deferred<Context>();
    const error = new Error('Storage read failed');
    h.hooks.prepare = () => pending.promise;
    const first = h.stream.ensure();
    h.stream.teardown();
    pending.reject(error);
    await first;
    expect(h.errors).toEqual([error]);
    expect([...h.timers.values()].map(timer => timer.delay)).toEqual([500]);
  });

  test('typed account cancellation is not a failure and rechecks the active account', async () => {
    const h = harness();
    h.hooks.prepare = () => Promise.reject(new AccountChangedError());
    await h.stream.ensure();
    expect(h.errors).toEqual([]);
    h.state.account = null;
    h.hooks.prepare = () => Promise.reject(new NoAccountError());
    expect(await h.fire()).toBe(500);
    expect(h.timers.size).toBe(0);
  });

  test('last-demand removal cancels retries and never resurrects an obsolete start', async () => {
    const h = harness();
    const pending = deferred<Context>();
    h.hooks.prepare = async assertCurrent => { const context = await pending.promise; assertCurrent(); return context; };
    const first = h.stream.ensure();
    h.state.wanted = false;
    h.stream.teardown();
    pending.resolve({ id: 'a' });
    await first;
    await h.stream.ensure();
    expect(h.errors).toEqual([]);
    expect(h.timers.size).toBe(0);
    expect(h.opened).toEqual([]);
  });

  test('one real close cancels its handles and rearms once despite reentrant callbacks', async () => {
    const h = harness();
    await h.stream.ensure();
    h.opened[0]?.close();
    h.opened[0]?.close();
    expect(h.opened[0]?.stops).toBe(1);
    expect(h.state.closed).toBe(1);
    expect(h.stream.live()).toBe(false);
    expect(h.timers.size).toBe(1);
    expect(await h.fire()).toBe(500);
    expect(h.opened).toHaveLength(2);
  });
});
