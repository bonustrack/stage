import { afterEach, beforeEach, describe, expect, jest, test } from 'bun:test';
import { rejectAfter } from '../src/timing';

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
