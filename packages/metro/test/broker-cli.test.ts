/**
 * End-to-end broker tests via the `metro` CLI in a sandboxed METRO_STATE_DIR:
 * `tail --as/--unclaimed/--all` webhook gating, per-mode cursor independence
 * (issue #34), and the claim/release round-trip. No real network.
 */

import { describe, expect, test, beforeEach, afterAll } from 'bun:test';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  WORKER_A, WORKER_B, CHAT_LINE,
  env, freshStateDir, cleanupAll, runCli, readClaims, writeClaim, seedHistory,
} from './broker-helpers.ts';

beforeEach(() => { env.STATE_DIR = freshStateDir(); });
afterAll(cleanupAll);

const idsFrom = (stdout: string): string[] =>
  stdout.trim().split('\n').filter(Boolean).map(l => JSON.parse(l).id);

describe('metro tail --as <id> end-to-end', () => {
  test('default --as worker-a hides webhook', () => {
    seedHistory();
    const r = runCli(['tail', '--as', WORKER_A, '--limit', '10', '--json']);
    expect(r.status).toBe(0);
    const ids = idsFrom(r.stdout);
    expect(ids).toContain('msg_1');
    expect(ids).toContain('msg_3');
    expect(ids).not.toContain('msg_2');
  });

  test('--as worker-a --include-webhooks shows webhook', () => {
    seedHistory();
    const r = runCli(['tail', '--as', WORKER_A, '--include-webhooks', '--limit', '10', '--json']);
    expect(r.status).toBe(0);
    expect(idsFrom(r.stdout)).toContain('msg_2');
  });

  test('--unclaimed shows webhook', () => {
    seedHistory();
    const r = runCli(['tail', '--unclaimed', '--limit', '10', '--json']);
    expect(r.status).toBe(0);
    expect(idsFrom(r.stdout)).toContain('msg_2');
  });

  test('--all shows webhook', () => {
    seedHistory();
    const r = runCli(['tail', '--all', '--limit', '10', '--json']);
    expect(r.status).toBe(0);
    expect(idsFrom(r.stdout)).toContain('msg_2');
  });

  test('claim by foreign owner excludes claimed line from worker-a mine-or-unclaimed', () => {
    seedHistory();
    writeClaim(CHAT_LINE, WORKER_B);
    const r = runCli(['tail', '--as', WORKER_A, '--limit', '10', '--json']);
    expect(idsFrom(r.stdout)).not.toContain('msg_1');
  });
});

describe('metro tail cursor independence (issue #34)', () => {
  test('--all writes cursors/_all, not cursors/<userSelf>', () => {
    seedHistory();
    const r = runCli(['tail', '--all', '--json'], { env: { CLAUDECODE: '1' } });
    expect(r.status).toBe(0);
    expect(existsSync(join(env.STATE_DIR, 'cursors', '_all'))).toBe(true);
    /** No per-user cursor should be written by an --all tail. */
    const files = readdirSync(join(env.STATE_DIR, 'cursors'));
    expect(files).toContain('_all');
    expect(files.some(f => f.startsWith('claude-user-'))).toBe(false);
  });

  test('--unclaimed writes cursors/_unclaimed', () => {
    seedHistory();
    const r = runCli(['tail', '--unclaimed', '--json'], { env: { CLAUDECODE: '1' } });
    expect(r.status).toBe(0);
    expect(existsSync(join(env.STATE_DIR, 'cursors', '_unclaimed'))).toBe(true);
  });

  test('--as=<me> writes cursors/<userSlug>', () => {
    seedHistory();
    const r = runCli(['tail', '--as', WORKER_A, '--json']);
    expect(r.status).toBe(0);
    /** userSlug('metro://user/worker-a') == 'user-worker-a' */
    expect(existsSync(join(env.STATE_DIR, 'cursors', 'user-worker-a'))).toBe(true);
  });

  test('--all then --as=<me> emit independently (the regression fix)', () => {
    seedHistory();
    /** First: --all consumes everything, writes _all. */
    const allRun = runCli(['tail', '--all', '--json'], { env: { CLAUDECODE: '1' } });
    expect(allRun.status).toBe(0);
    expect(idsFrom(allRun.stdout)).toEqual(['msg_1', 'msg_2', 'msg_3']);

    /** Then: --as=<me> should still see fresh personal events (its cursor is independent). */
    const asRun = runCli(['tail', '--as', WORKER_A, '--json']);
    expect(asRun.status).toBe(0);
    const asIds = idsFrom(asRun.stdout);
    /** Worker-A in mine-or-unclaimed: chat + telegram visible, webhook hidden. */
    expect(asIds).toContain('msg_1');
    expect(asIds).toContain('msg_3');
    expect(asIds).not.toContain('msg_2');
  });

  test('--include-webhooks gets a separate cursor from --as alone', () => {
    seedHistory();
    runCli(['tail', '--as', WORKER_A, '--json']);
    runCli(['tail', '--as', WORKER_A, '--include-webhooks', '--json']);
    const files = readdirSync(join(env.STATE_DIR, 'cursors'));
    expect(files).toContain('user-worker-a');
    expect(files).toContain('user-worker-a--with-webhooks');
  });
});

describe('metro claim CLI auto-claim simulation', () => {
  test('metro claims is empty initially', () => {
    const r = runCli(['claims', '--json']);
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout)).toEqual({ claims: {} });
  });

  test('metro claim adds + metro release removes', () => {
    const c = runCli(['claim', CHAT_LINE, '--as', WORKER_A, '--json']);
    expect(c.status).toBe(0);
    expect(readClaims()[CHAT_LINE]).toBe(WORKER_A);
    const r = runCli(['release', CHAT_LINE, '--json']);
    expect(r.status).toBe(0);
    expect(readClaims()[CHAT_LINE]).toBeUndefined();
  });
});
