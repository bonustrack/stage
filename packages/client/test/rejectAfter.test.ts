import { afterEach, beforeEach, describe, expect, jest, test } from 'bun:test';
import { rejectAfter, settleBy, settleWithin } from '../src/timing';

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('rejectAfter', () => {
  test('rejects with the given error when the work never answers', async () => {
    const hung = new Promise<string>(() => undefined);
    const outcome = rejectAfter(hung, 20, () => new Error('too slow')).catch((err: unknown) => err);
    jest.advanceTimersByTime(20);
    expect(await outcome).toEqual(new Error('too slow'));
  });

  test('passes a result or a failure through untouched', async () => {
    expect(await rejectAfter(Promise.resolve(7), 1_000, () => new Error('slow'))).toBe(7);
    await expect(rejectAfter(Promise.reject(new Error('nope')), 1_000, () => new Error('slow'))).rejects.toThrow('nope');
  });

  test('hands a value that arrives after the deadline to the late handler', async () => {
    const late = Promise.withResolvers<string>();
    const disposed: string[] = [];
    const outcome = rejectAfter(
      late.promise,
      20,
      () => new Error('too slow'),
      (value) => disposed.push(value),
    ).catch((err: unknown) => err);
    jest.advanceTimersByTime(20);
    expect(await outcome).toEqual(new Error('too slow'));
    late.resolve('client');
    await late.promise;
    await Promise.resolve();
    expect(disposed).toEqual(['client']);
  });
});

describe('settleWithin', () => {
  test('answers the fallback from one timer, however the clock moves', async () => {
    const outcome = settleWithin(new Promise<string>(() => undefined), 20, 'fallback');
    jest.setSystemTime(Date.now() + 60_000);
    expect(jest.getTimerCount()).toBe(1);
    jest.advanceTimersByTime(20);
    expect(await outcome).toBe('fallback');
    expect(jest.getTimerCount()).toBe(0);
  });

  test('passes the work through and clears its timer', async () => {
    expect(await settleWithin(Promise.resolve('done'), 1_000, 'fallback')).toBe('done');
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe('settleBy', () => {
  test('checks the wall clock every tick, so a clock jump ends the wait at the next tick', async () => {
    const outcome = settleBy(new Promise<string>(() => undefined), Date.now() + 10_000, 'fallback', 1_000);
    jest.setSystemTime(Date.now() + 10_000);
    jest.advanceTimersByTime(1_000);
    expect(await outcome).toBe('fallback');
    expect(jest.getTimerCount()).toBe(0);
  });

  test('a passed deadline answers the fallback without a timer', async () => {
    expect(await settleBy(new Promise<string>(() => undefined), Date.now() - 1, 'fallback')).toBe('fallback');
    expect(jest.getTimerCount()).toBe(0);
  });
});
