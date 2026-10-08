import { describe, expect, test } from 'bun:test';
import { checkedCommit, pollingAttempts, sourceRun, waitForSourceCi } from '../ci-gate.mjs';

const SHA = 'a'.repeat(40);
const OTHER_SHA = 'b'.repeat(40);
const TARGET = { sha: SHA, branch: 'main', repository: 'bonustrack/stage' };
const SUCCESS = {
  id: 12,
  head_sha: SHA,
  head_branch: 'main',
  head_repository: { full_name: 'bonustrack/stage' },
  path: '.github/workflows/ci.yml',
  event: 'push',
  status: 'completed',
  conclusion: 'success',
};

function fixture(responses, options = {}) {
  const requests = [];
  const waits = [];
  const messages = [];
  const run = () => waitForSourceCi({
    ...TARGET,
    attempts: 3,
    interval: 10,
    request: async (url, init) => {
      requests.push({ url: String(url), init });
      const next = responses.shift();
      if (next instanceof Error) throw next;
      return next ?? Response.json({ workflow_runs: [] });
    },
    sleep: async (ms) => { waits.push(ms); },
    log: (message) => { messages.push(message); },
    ...options,
  });
  return { run, requests, waits, messages };
}

function runs(...entries) {
  return Response.json({ workflow_runs: entries });
}

describe('deployment commit', () => {
  test('requires the exact checked out commit', () => {
    expect(checkedCommit(SHA, SHA)).toBe(SHA);
    expect(() => checkedCommit(SHA, OTHER_SHA)).toThrow('does not match');
    expect(() => checkedCommit(SHA.slice(0, 7), SHA)).toThrow('does not match');
    expect(() => checkedCommit(undefined, SHA)).toThrow('does not match');
  });
});

describe('source CI deadline', () => {
  test('allows supported 90-minute CI and a runner queue by default', () => {
    expect(pollingAttempts()).toBe(241);
    expect(pollingAttempts('180')).toBe(361);
    expect(pollingAttempts('1')).toBe(3);
  });

  test.each(['0', '-1', '181', '1.5', '', 'no'])('rejects invalid minutes %s', (minutes) => {
    expect(() => pollingAttempts(minutes)).toThrow('CI_WAIT_MINUTES');
  });

  test('can complete after 90 minutes without real sleeps', async () => {
    const pending = Array.from({ length: 181 }, () => runs({ ...SUCCESS, status: 'in_progress' }));
    const check = fixture([...pending, runs(SUCCESS)], { attempts: pollingAttempts(), interval: 30_000 });
    expect(await check.run()).toEqual(SUCCESS);
    expect(check.waits.reduce((sum, ms) => sum + ms, 0)).toBeGreaterThan(90 * 60_000);
  });
});

describe('source CI selection', () => {
  test.each([
    { head_sha: OTHER_SHA },
    { head_branch: 'other' },
    { head_repository: { full_name: 'other/stage' } },
    { head_repository: null },
    { path: '.github/workflows/main-preview.yml' },
    { event: 'pull_request' },
    { event: 'workflow_run' },
  ])('rejects a different source or workflow: %j', (change) => {
    expect(sourceRun([{ ...SUCCESS, ...change }], TARGET)).toBeUndefined();
  });

  test('allows an exact manual source CI run', () => {
    const manual = { ...SUCCESS, event: 'workflow_dispatch' };
    expect(sourceRun([manual], TARGET)).toBe(manual);
  });

  test('selects the newest matching run, not an older green run', () => {
    const latest = { ...SUCCESS, id: 13, status: 'in_progress', conclusion: null };
    expect(sourceRun([SUCCESS, latest], TARGET)).toBe(latest);
  });
});

describe('source CI gate', () => {
  test('passes a completed exact-SHA check without credentials on a public repo', async () => {
    const check = fixture([runs(SUCCESS)]);
    expect(await check.run()).toEqual(SUCCESS);
    expect(check.waits).toEqual([]);
    expect(check.requests).toHaveLength(1);
    expect(check.requests[0].init.headers.Authorization).toBeUndefined();
    const url = new URL(check.requests[0].url);
    expect(url.origin).toBe('https://api.github.com');
    expect(url.pathname).toBe('/repos/bonustrack/stage/actions/workflows/ci.yml/runs');
    expect(url.searchParams.get('head_sha')).toBe(SHA);
    expect(url.searchParams.get('branch')).toBe('main');
  });

  test('waits for queued or initially missing CI', async () => {
    const check = fixture([runs(), runs({ ...SUCCESS, status: 'queued', conclusion: null }), runs(SUCCESS)]);
    await check.run();
    expect(check.waits).toEqual([10, 10]);
    expect(check.requests).toHaveLength(3);
  });

  test.each(['failure', 'cancelled', 'skipped', 'timed_out', 'neutral', null])(
    'refuses terminal conclusion %s even if an older run passed', async (conclusion) => {
      const check = fixture([runs(SUCCESS, { ...SUCCESS, id: 13, conclusion })]);
      await expect(check.run()).rejects.toThrow('refusing to publish');
      expect(check.waits).toEqual([]);
    },
  );

  test('times out without a matching successful run', async () => {
    const check = fixture([runs({ ...SUCCESS, head_sha: OTHER_SHA })]);
    await expect(check.run()).rejects.toThrow('deployment deadline');
    expect(check.requests).toHaveLength(3);
    expect(check.waits).toHaveLength(2);
  });

  test.each([403, 404, 429, 500])('fails closed for HTTP %s', async (status) => {
    const check = fixture([new Response('not available', { status })]);
    await expect(check.run()).rejects.toThrow(`HTTP ${status}`);
    expect(check.requests).toHaveLength(1);
    expect(check.waits).toEqual([]);
  });

  test('fails closed for network and malformed responses', async () => {
    await expect(fixture([new Error('offline')]).run()).rejects.toThrow('offline');
    await expect(fixture([Response.json({})]).run()).rejects.toThrow('no workflow run list');
    await expect(fixture([new Response('not json')]).run()).rejects.toThrow();
  });

  test('authenticates only to the fixed GitHub API and never logs the token', async () => {
    const check = fixture([runs(SUCCESS)], { token: 'test-only' });
    await check.run();
    expect(check.requests[0].init.headers.Authorization).toBe('Bearer test-only');
    expect(check.messages.join(' ')).not.toContain('test-only');
  });

  test.each([{ sha: 'main' }, { sha: undefined }, { branch: '' }, { repository: '../other' }])(
    'rejects invalid inputs before a request: %j', async (options) => {
      const check = fixture([], options);
      await expect(check.run()).rejects.toThrow('exact commit');
      expect(check.requests).toEqual([]);
    },
  );
});
