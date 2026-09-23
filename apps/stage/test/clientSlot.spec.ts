import { describe, expect, test } from 'bun:test';
import { createClientSlot } from '../lib/storeCore';

function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void } {
  let resolve: (v: T) => void = () => undefined;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

describe('createClientSlot', () => {
  test('concurrent callers share one build', async () => {
    const slot = createClientSlot<string>(() => undefined);
    let builds = 0;
    const build = deferred<string>();
    const create = (): Promise<string> => { builds += 1; return build.promise; };
    const a = slot.getOrCreate(create);
    const b = slot.getOrCreate(create);
    build.resolve('client-a');
    expect(await Promise.all([a, b])).toEqual(['client-a', 'client-a']);
    expect(builds).toBe(1);
  });

  test('after a reset the next caller starts a fresh build instead of reusing the stale one', async () => {
    const slot = createClientSlot<string>(() => undefined);
    const stale = deferred<string>();
    void slot.getOrCreate(() => stale.promise);
    slot.reset();
    const fresh = deferred<string>();
    const next = slot.getOrCreate(() => fresh.promise);
    let builds = 0;
    const joined = slot.getOrCreate(() => { builds += 1; return Promise.resolve('third'); });
    stale.resolve('client-a');
    await Promise.resolve();
    fresh.resolve('client-b');
    expect(await next).toBe('client-b');
    expect(await joined).toBe('client-b');
    expect(builds).toBe(0);
  });
});
