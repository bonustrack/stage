import { expect, test } from 'bun:test';
import { timeSendPhase } from '@stage-labs/client/xmtp/sendTiming';
import { makeSendTimingDiagnostic } from '../lib/sendTiming.core';

function fixture() {
  let now = 0;
  const diagnostic = makeSendTimingDiagnostic(() => now);
  return {
    diagnostic,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

test('timing is opt-in and the disabled path returns the original promise without reading the clock', async () => {
  let clocks = 0;
  const d = makeSendTimingDiagnostic(() => {
    clocks += 1;
    return clocks;
  });
  expect(d.begin()).toBeUndefined();
  const promise = Promise.resolve('synthetic message result');
  expect(timeSendPhase(d.begin(), 'sdk.send', () => promise)).toBe(promise);
  expect(await promise).toBe('synthetic message result');
  expect(clocks).toBe(0);
  expect(d.read()).toEqual([]);
});

test('snapshots contain only fixed phases and durations, not results, errors or identifiers', async () => {
  const f = fixture();
  f.diagnostic.start();
  const timing = f.diagnostic.begin();
  const result = { message: 'synthetic private text', accountId: 'synthetic-account', url: 'https://private.invalid' };
  expect(
    await timeSendPhase(timing, 'conversation.find', async () => {
      f.advance(7);
      return result;
    }),
  ).toBe(result);
  const error = new Error('synthetic private error and account identifier');
  await expect(
    timeSendPhase(timing, 'sdk.send', async () => {
      f.advance(23);
      throw error;
    }),
  ).rejects.toBe(error);
  timing?.finish();
  const expected = [
    [
      { phase: 'conversation.find', durationMs: 7 },
      { phase: 'sdk.send', durationMs: 23 },
      { phase: 'xmtp.total', durationMs: 30 },
    ],
  ];
  expect(f.diagnostic.read()).toEqual(expected);
  const copy = f.diagnostic.read();
  copy[0]?.splice(0);
  expect(f.diagnostic.read()).toEqual(expected);
  expect(JSON.stringify(f.diagnostic.read())).not.toContain('private');
});

test('the same synchronous exception is rethrown without being retained', () => {
  const f = fixture();
  f.diagnostic.start();
  const timing = f.diagnostic.begin();
  const error = new Error('synthetic secret');
  expect(() =>
    timeSendPhase(timing, 'sdk.send', () => {
      f.advance(5);
      throw error;
    }),
  ).toThrow(error);
  timing?.finish();
  expect(f.diagnostic.read()).toEqual([
    [
      { phase: 'sdk.send', durationMs: 5 },
      { phase: 'xmtp.total', durationMs: 5 },
    ],
  ]);
});

test('overlapping sends stay separate without any stored send identifiers', () => {
  const f = fixture();
  f.diagnostic.start();
  const first = f.diagnostic.begin();
  const endFirst = first?.phase('sdk.send');
  f.advance(3);
  const second = f.diagnostic.begin();
  const endSecond = second?.phase('filter.queue');
  f.advance(5);
  endSecond?.();
  second?.finish();
  f.advance(2);
  endFirst?.();
  first?.finish();
  first?.finish();
  endFirst?.();
  expect(f.diagnostic.read()).toEqual([
    [
      { phase: 'filter.queue', durationMs: 5 },
      { phase: 'xmtp.total', durationMs: 5 },
    ],
    [
      { phase: 'sdk.send', durationMs: 10 },
      { phase: 'xmtp.total', durationMs: 10 },
    ],
  ]);
});

test('stop clears completed and pending measurements and rejects late completion', () => {
  const f = fixture();
  f.diagnostic.start();
  f.diagnostic.begin()?.finish();
  const pending = f.diagnostic.begin();
  const end = pending?.phase('sdk.send');
  f.diagnostic.stop();
  end?.();
  pending?.finish();
  expect(f.diagnostic.read()).toEqual([]);
  expect(f.diagnostic.begin()).toBeUndefined();
  f.diagnostic.start();
  pending?.finish();
  expect(f.diagnostic.read()).toEqual([]);
});

test('clear and repeated start invalidate pending traces without mixing recording sessions', () => {
  const f = fixture();
  for (const reset of [f.diagnostic.clear, f.diagnostic.start]) {
    f.diagnostic.start();
    const old = f.diagnostic.begin();
    const end = old?.phase('sdk.send');
    reset();
    f.advance(8);
    end?.();
    old?.finish();
    const fresh = f.diagnostic.begin();
    expect(fresh).toBeDefined();
    fresh?.finish();
    expect(f.diagnostic.read()).toEqual([[{ phase: 'xmtp.total', durationMs: 0 }]]);
  }
});

test('storage is bounded to ten completed and ten pending sends, with sixty-four samples each', () => {
  const f = fixture();
  f.diagnostic.start();
  for (let i = 0; i < 12; i += 1) {
    const timing = f.diagnostic.begin();
    for (let n = 0; n < 80; n += 1) timing?.phase('filter.http')();
    f.advance(i);
    timing?.finish();
  }
  expect(f.diagnostic.read()).toHaveLength(10);
  expect(f.diagnostic.read().every((samples) => samples.length === 64)).toBe(true);
  expect(f.diagnostic.read()[0]?.at(-1)).toEqual({ phase: 'xmtp.total', durationMs: 2 });
  const pending = Array.from({ length: 10 }, () => f.diagnostic.begin());
  expect(pending.every(Boolean)).toBe(true);
  expect(f.diagnostic.begin()).toBeUndefined();
  pending[0]?.finish();
  expect(f.diagnostic.begin()).toBeDefined();
});

test('settlement closes unfinished phases at the observed wait and ignores their late completion', async () => {
  const f = fixture();
  f.diagnostic.start();
  const timing = f.diagnostic.begin();
  let release = (): void => undefined;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const work = timeSendPhase(timing, 'filter.keys', () => pending);
  f.advance(30);
  timing?.finish();
  const expected = [
    [
      { phase: 'filter.keys', durationMs: 30 },
      { phase: 'xmtp.total', durationMs: 30 },
    ],
  ];
  expect(f.diagnostic.read()).toEqual(expected);
  f.advance(200);
  release();
  await work;
  expect(f.diagnostic.read()).toEqual(expected);
});

test('outstanding phase storage is bounded before any of those phases finish', () => {
  const f = fixture();
  f.diagnostic.start();
  const timing = f.diagnostic.begin();
  const ends = Array.from({ length: 100 }, () => timing?.phase('filter.http'));
  f.advance(15);
  timing?.finish();
  const rows = f.diagnostic.read();
  expect(rows[0]).toHaveLength(64);
  expect(rows[0]?.filter((sample) => sample.phase === 'filter.http')).toHaveLength(63);
  for (const end of ends) end?.();
  expect(f.diagnostic.read()).toEqual(rows);
});

test('invalid, backwards and throwing clocks cannot affect sends or expose raw clock errors', async () => {
  let now = 100;
  const d = makeSendTimingDiagnostic(() => {
    if (now === -1) throw new Error('synthetic clock secret');
    return now;
  });
  d.start();
  const timing = d.begin();
  for (const value of [-2, Number.NaN, Number.POSITIVE_INFINITY, -1]) {
    now = 100;
    await timeSendPhase(timing, 'sdk.send', async () => {
      now = value;
      return 'real-id';
    });
  }
  timing?.finish();
  expect(d.read()).toEqual([[]]);
});
