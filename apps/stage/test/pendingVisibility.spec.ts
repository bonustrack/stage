import { afterEach, beforeEach, expect, jest, mock, test } from 'bun:test';

let activeId = 'a';
mock.module('../lib/accounts', () => ({ getActiveAccount: async () => ({ id: activeId }) }));
const { createVisibilityPublisher } = await import('../lib/pendingVisibility');

async function advance(ms: number): Promise<void> {
  jest.advanceTimersByTime(ms);
  for (let i = 0; i < 12; i += 1) await Promise.resolve();
}

beforeEach(() => { activeId = 'a'; jest.useFakeTimers(); });
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

test('dirty visibility retries without another foreground or account event', async () => {
  let calls = 0;
  const queue = createVisibilityPublisher(async () => { calls += 1; if (calls === 1) throw new Error('offline'); return true; });
  queue('a');
  await advance(800);
  expect(calls).toBe(1);
  await advance(5000);
  expect(calls).toBe(2);
  await advance(60_000);
  expect(calls).toBe(2);
});

test('old-account completion cannot cancel the new account timer', async () => {
  const release = Promise.withResolvers<boolean>();
  const sent: string[] = [];
  const queue = createVisibilityPublisher(async id => { sent.push(id); return id === 'a' ? release.promise : true; });
  queue('a');
  await advance(800);
  activeId = 'b';
  queue('b');
  release.resolve(true);
  await advance(800);
  expect(sent).toEqual(['a', 'b']);
});

test('a newer revision during an in-flight send remains dirty', async () => {
  const release = Promise.withResolvers<boolean>();
  let calls = 0;
  const queue = createVisibilityPublisher(async () => { calls += 1; return calls === 1 ? release.promise : true; });
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
  const queue = createVisibilityPublisher(async id => { sent.push(id); return true; });
  queue('b');
  await advance(800);
  await advance(60_000);
  expect(sent).toEqual([]);
  activeId = 'b';
  queue('b');
  await advance(800);
  expect(sent).toEqual(['b']);
});

test('rate limiting stops retries for the session, including later automatic requests', async () => {
  let calls = 0;
  const queue = createVisibilityPublisher(async () => { calls += 1; throw new Error('RESOURCE_EXHAUSTED: rate limit 429'); });
  queue('a');
  await advance(800);
  await advance(600_000);
  queue('a');
  await advance(800);
  expect(calls).toBe(1);
});
