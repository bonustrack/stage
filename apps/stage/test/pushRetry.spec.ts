import { expect, test } from 'bun:test';
import { makePushRetry } from '../lib/pushRetry.core';

test('failed preference refreshes coalesce and retry with bounded backoff until success', () => {
  const scheduled = new Map<number, { run: () => void; delay: number }>();
  let next = 0;
  const retry = makePushRetry((run, delay) => {
    const id = next++;
    scheduled.set(id, { run, delay });
    return () => { scheduled.delete(id); };
  });
  let attempts = 0;
  const run = (): void => { attempts += 1; };
  for (const expected of [5_000, 10_000, 20_000, 40_000, 60_000, 60_000]) {
    retry.failed('mobile', run);
    retry.failed('mobile', run);
    expect(scheduled.size).toBe(1);
    const job = scheduled.values().next().value;
    expect(job?.delay).toBe(expected);
    scheduled.clear();
    job?.run();
  }
  expect(attempts).toBe(6);
  retry.success('mobile');
  retry.failed('mobile', run);
  expect(scheduled.values().next().value?.delay).toBe(5_000);
  retry.success('mobile');
  expect(scheduled.size).toBe(0);
  retry.failed('mobile', run);
  retry.failed('other', run);
  expect(scheduled.size).toBe(2);
  retry.clear();
  expect(scheduled.size).toBe(0);
});
