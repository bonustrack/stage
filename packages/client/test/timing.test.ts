import { afterEach, describe, expect, test } from 'bun:test';
import { FetchTimeoutError, fetchWithin, linkedDeadline, sleep } from '../src/timing';
import { fakeFetch } from './helpers';

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

const REASONS = { cancelled: () => new Error('cancelled'), timedOut: () => new Error('timed out') };

describe('linkedDeadline', () => {
  test('aborts with the cancel reason when the outer signal aborts, now or later', () => {
    const outer = new AbortController();
    const linked = linkedDeadline(1_000, outer.signal, REASONS);
    expect(linked.signal.aborted).toBe(false);
    outer.abort();
    expect(linked.signal.reason).toEqual(new Error('cancelled'));
    linked.release();
    expect(linkedDeadline(1_000, outer.signal, REASONS).signal.reason).toEqual(new Error('cancelled'));
  });

  test('aborts with the timeout reason once the deadline passes', async () => {
    const linked = linkedDeadline(5, undefined, REASONS);
    await sleep(20);
    expect(linked.signal.reason).toEqual(new Error('timed out'));
  });

  test('a released deadline no longer follows the outer signal or the timer', async () => {
    const outer = new AbortController();
    const linked = linkedDeadline(5, outer.signal, REASONS);
    linked.release();
    outer.abort();
    await sleep(20);
    expect(linked.signal.aborted).toBe(false);
  });
});

describe('fetchWithin', () => {
  test('reads the response before the deadline', async () => {
    globalThis.fetch = fakeFetch(async () => Response.json({ ok: 1 }));
    expect(await fetchWithin('https://x.test', {}, { timeoutMs: 1_000 }, (res) => res.json())).toEqual({ ok: 1 });
  });

  test('fails with FetchTimeoutError and aborts the request when it is too slow', async () => {
    let signal: AbortSignal | null | undefined;
    globalThis.fetch = fakeFetch(async (_input, init) => {
      signal = init?.signal;
      await sleep(50);
      return Response.json({});
    });
    await expect(fetchWithin('https://x.test', {}, { timeoutMs: 5 })).rejects.toBeInstanceOf(FetchTimeoutError);
    expect(signal?.aborted).toBe(true);
  });
});
