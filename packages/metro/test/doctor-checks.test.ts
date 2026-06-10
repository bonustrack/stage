/** Unit tests for the `metro doctor` check primitives (file/perm/env parsing).
 *
 * Pure, FS-mocked via temp dirs. Live HTTP/socket/process probes are NOT exercised
 * here (they require a network/daemon) — the builders accept skipLive for that. */

import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  countLines, countPushTokens, fileMode, isLockedDown, octal, resolveEnv,
  tunnelFix, fcmChecks, credChecks, runFailureChecks, TUNNELS, REQUIRED_CREDS,
} from '../src/cli/doctor-checks.ts';

const roots: string[] = [];
function tmp(): string { const d = mkdtempSync(join(tmpdir(), 'metro-doctor-')); roots.push(d); return d; }
afterEach(() => { for (const d of roots.splice(0)) try { rmSync(d, { recursive: true, force: true }); } catch { /* ignore */ } });

describe('file/perm primitives', () => {
  test('fileMode returns null for a missing file', () => {
    expect(fileMode(join(tmp(), 'nope'))).toBeNull();
  });
  test('fileMode reflects chmod 0600', () => {
    const f = join(tmp(), 'k'); writeFileSync(f, 'secret'); chmodSync(f, 0o600);
    expect(fileMode(f)).toBe(0o600);
    expect(isLockedDown(0o600)).toBe(true);
  });
  test('isLockedDown rejects group/other bits', () => {
    expect(isLockedDown(0o644)).toBe(false);
    expect(isLockedDown(0o660)).toBe(false);
    expect(isLockedDown(0o640)).toBe(false);
    expect(isLockedDown(0o400)).toBe(true);
  });
  test('octal formats 3-digit zero-padded', () => {
    expect(octal(0o600)).toBe('0600');
    expect(octal(0o644)).toBe('0644');
  });
});

describe('countLines', () => {
  test('0 for missing file', () => { expect(countLines(join(tmp(), 'x.jsonl'))).toBe(0); });
  test('ignores blank lines', () => {
    const f = join(tmp(), 'o.jsonl'); writeFileSync(f, '{"a":1}\n\n{"b":2}\n\n');
    expect(countLines(f)).toBe(2);
  });
});

describe('countPushTokens', () => {
  test('null for missing/unparseable', () => {
    expect(countPushTokens(join(tmp(), 'p.json'))).toBeNull();
    const bad = join(tmp(), 'bad.json'); writeFileSync(bad, 'not json');
    expect(countPushTokens(bad)).toBeNull();
  });
  test('array shape', () => {
    const f = join(tmp(), 'a.json'); writeFileSync(f, JSON.stringify(['t1', 't2', 't3']));
    expect(countPushTokens(f)).toBe(3);
  });
  test('{tokens:[]} shape', () => {
    const f = join(tmp(), 'b.json'); writeFileSync(f, JSON.stringify({ tokens: ['t1'] }));
    expect(countPushTokens(f)).toBe(1);
  });
  test('object-map shape', () => {
    const f = join(tmp(), 'c.json'); writeFileSync(f, JSON.stringify({ dev1: 'x', dev2: 'y' }));
    expect(countPushTokens(f)).toBe(2);
  });
  test('0 tokens detected (push silently off)', () => {
    const f = join(tmp(), 'e.json'); writeFileSync(f, JSON.stringify([]));
    expect(countPushTokens(f)).toBe(0);
  });
});

describe('resolveEnv precedence (cwd/.env wins over ~/.metro/.env)', () => {
  let prevCwd: string;
  beforeEach(() => { prevCwd = process.cwd(); });
  afterEach(() => { process.chdir(prevCwd); });

  test('reports winner + shadowed origins by file precedence', () => {
    // cwd/.env is the highest-precedence source in envSources().
    // Use a synthetic key so the assertion is hermetic regardless of host ~/.config/metro/.env.
    const dir = tmp();
    writeFileSync(join(dir, '.env'), 'METRO_DOCTOR_TEST_KEY=from-cwd\n');
    process.chdir(dir);
    const res = resolveEnv(['METRO_DOCTOR_TEST_KEY', 'METRO_DOCTOR_ABSENT_KEY']);
    expect(res.winner.METRO_DOCTOR_TEST_KEY?.label).toBe('cwd/.env');
    expect(res.winner.METRO_DOCTOR_TEST_KEY?.value).toBe('from-cwd');
    // A key set nowhere has no winner.
    expect(res.winner.METRO_DOCTOR_ABSENT_KEY).toBeUndefined();
  });
});

describe('check builders', () => {
  test('tunnelFix prints the exact restart command per tunnel', () => {
    const bundler = TUNNELS.find(t => t.name === 'bundler')!;
    expect(tunnelFix(bundler)).toBe('cloudflared tunnel run --url http://127.0.0.1:8081 bundler');
  });
  test('fcmChecks returns service-account + push-tokens checks with fixes', () => {
    const checks = fcmChecks();
    const names = checks.map(c => c.name);
    expect(names).toContain('fcm:service-account');
    expect(names).toContain('fcm:push-tokens');
    // Absent on the test host ⇒ warn (not a hard fail) with a fix string.
    for (const c of checks) if (c.status !== 'pass') expect(c.fix).toBeTruthy();
  });
  test('credChecks covers every required credential', () => {
    const checks = credChecks();
    for (const { key } of REQUIRED_CREDS) expect(checks.some(c => c.name === `cred:${key}`)).toBe(true);
  });
  test('runFailureChecks skipLive omits tunnel + daemon probes but keeps offline checks', async () => {
    const checks = await runFailureChecks({ skipLive: true });
    expect(checks.some(c => c.name.startsWith('tunnel:'))).toBe(false);
    expect(checks.some(c => c.name.startsWith('daemon:'))).toBe(false);
    expect(checks.some(c => c.name.startsWith('cred:'))).toBe(true);
    expect(checks.some(c => c.name.startsWith('fcm:'))).toBe(true);
  });
});
