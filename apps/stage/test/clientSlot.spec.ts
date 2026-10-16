import { describe, expect, test } from 'bun:test';
import { createClientSlot } from '../lib/xmtp.state.core';

describe('createClientSlot', () => {
  test('concurrent callers share one build', async () => {
    const slot = createClientSlot<string>(() => undefined);
    let builds = 0;
    const build = Promise.withResolvers<string>();
    const create = (): Promise<string> => { builds += 1; return build.promise; };
    const a = slot.getOrCreate(create);
    const b = slot.getOrCreate(create);
    build.resolve('client-a');
    expect(await Promise.all([a, b])).toEqual(['client-a', 'client-a']);
    expect(builds).toBe(1);
    expect(slot.get()).toBe('client-a');
    expect(await slot.getOrCreate(() => Promise.resolve('unused'))).toBe('client-a');
  });

  test('a failed build is not ready and a retry builds again', async () => {
    const slot = createClientSlot<string>(() => undefined);
    await expect(slot.getOrCreate(() => Promise.reject(new Error('metadata failed')))).rejects.toThrow('metadata failed');
    expect(slot.get()).toBeNull();
    expect(await slot.getOrCreate(() => Promise.resolve('retry'))).toBe('retry');
    expect(slot.get()).toBe('retry');
  });

  test('after a reset the next caller starts a fresh build instead of reusing the stale one', async () => {
    const slot = createClientSlot<string>(() => undefined);
    const stale = Promise.withResolvers<string>();
    const old = slot.getOrCreate(() => stale.promise).catch((e: unknown) => e);
    slot.reset();
    const fresh = Promise.withResolvers<string>();
    const next = slot.getOrCreate(() => fresh.promise);
    let builds = 0;
    const joined = slot.getOrCreate(() => { builds += 1; return Promise.resolve('third'); });
    stale.resolve('client-a');
    await Promise.resolve();
    fresh.resolve('client-b');
    expect(await next).toBe('client-b');
    expect(await joined).toBe('client-b');
    expect(builds).toBe(0);
    expect(await old).toBeInstanceOf(Error);
    expect(slot.get()).toBe('client-b');
  });

  test('reset rejects every joined obsolete caller and discards its client exactly once', async () => {
    const discarded: string[] = [];
    const slot = createClientSlot<string>(() => undefined, (client) => { discarded.push(client); });
    const work = Promise.withResolvers<string>();
    const first = slot.getOrCreate(() => work.promise).catch((e: unknown) => e);
    const joined = slot.getOrCreate(() => Promise.resolve('unused')).catch((e: unknown) => e);
    slot.reset();
    work.resolve('obsolete');
    expect(await first).toBeInstanceOf(Error);
    expect(await joined).toBeInstanceOf(Error);
    expect(slot.get()).toBeNull();
    expect(discarded).toEqual(['obsolete']);
  });
});
