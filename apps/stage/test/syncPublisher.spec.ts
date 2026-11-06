import { afterEach, beforeEach, expect, jest, test } from 'bun:test';
import { createSyncPublisher } from '../lib/sync/publisher';
import { AccountChangedError, rememberActiveAccountId } from '../lib/accountSelection';

function accountQueue(send: (accountId: string) => Promise<unknown>): (accountId: string) => void {
  const publish = createSyncPublisher();
  return (accountId) => {
    publish({
      key: `clear:${accountId}`,
      accountId,
      send: async () => {
        await send(accountId);
      },
    });
  };
}

async function advance(ms: number): Promise<void> {
  jest.advanceTimersByTime(ms);
  for (let i = 0; i < 12; i += 1) await Promise.resolve();
}

beforeEach(() => {
  rememberActiveAccountId('a');
  jest.useFakeTimers();
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

test('dirty visibility retries without another foreground or account event', async () => {
  let calls = 0;
  const queue = accountQueue(async () => {
    calls += 1;
    if (calls === 1) throw new Error('offline');
    return true;
  });
  queue('a');
  await advance(800);
  expect(calls).toBe(1);
  await advance(5000);
  expect(calls).toBe(2);
  await advance(60_000);
  expect(calls).toBe(2);
});

test('repeated failures back off from 5 s up to a minute', async () => {
  const at: number[] = [];
  let now = 0;
  const queue = accountQueue(async () => {
    at.push(now);
    throw new Error('offline');
  });
  queue('a');
  for (const step of [800, 5000, 10_000, 20_000, 40_000, 60_000, 60_000]) {
    now += step;
    await advance(step);
  }
  expect(at).toEqual([800, 5800, 15_800, 35_800, 75_800, 135_800, 195_800]);
});

test('old-account completion cannot cancel the new account timer', async () => {
  const release = Promise.withResolvers<boolean>();
  const sent: string[] = [];
  const queue = accountQueue(async (id) => {
    sent.push(id);
    return id === 'a' ? release.promise : true;
  });
  queue('a');
  await advance(800);
  rememberActiveAccountId('b');
  queue('b');
  release.resolve(true);
  await advance(800);
  expect(sent).toEqual(['a', 'b']);
});

test('a newer revision during an in-flight send remains dirty', async () => {
  const release = Promise.withResolvers<boolean>();
  let calls = 0;
  const queue = accountQueue(async () => {
    calls += 1;
    return calls === 1 ? release.promise : true;
  });
  queue('a');
  await advance(800);
  queue('a');
  await advance(800);
  expect(calls).toBe(1);
  release.resolve(true);
  await advance(0);
  await advance(800);
  expect(calls).toBe(2);
});

test('an inactive account is not published through the current client', async () => {
  const sent: string[] = [];
  const queue = accountQueue(async (id) => {
    sent.push(id);
    return true;
  });
  queue('b');
  await advance(800);
  await advance(60_000);
  expect(sent).toEqual([]);
  rememberActiveAccountId('b');
  queue('b');
  await advance(800);
  expect(sent).toEqual(['b']);
});

test('an account switch during a send keeps the change for the next request instead of retrying', async () => {
  let calls = 0;
  const queue = accountQueue(async () => {
    calls += 1;
    if (calls === 1) throw new AccountChangedError();
    return true;
  });
  queue('a');
  await advance(800);
  await advance(60_000);
  expect(calls).toBe(1);
  queue('a');
  await advance(800);
  expect(calls).toBe(2);
});

test('rate limiting stops retries for the session, including later automatic requests', async () => {
  let calls = 0;
  const queue = accountQueue(async () => {
    calls += 1;
    throw new Error('RESOURCE_EXHAUSTED: rate limit 429');
  });
  queue('a');
  await advance(800);
  await advance(600_000);
  queue('a');
  await advance(800);
  expect(calls).toBe(1);
});
