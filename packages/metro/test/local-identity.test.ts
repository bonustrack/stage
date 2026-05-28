/**
 * Unit tests for `src/local-identity.ts` — claude/codex user + session id resolution.
 *
 * Env-only resolvers (METRO_USER_ID / METRO_USER_SESSION_ID short-circuits,
 * CLAUDE_CODE_SESSION_ID fallback, codex session file fallback,
 * setCodexSessionId round-trip) are tested in-process.
 *
 * The codex *account-id* loader (which reads $CODEX_HOME/auth.json and has
 * several throw branches) is memoized, so each of its cases runs in a FRESH
 * Node subprocess against dist/local-identity.js with CODEX_HOME pointed at a
 * temp dir. The real ~/.codex/auth.json is never read. No `claude` CLI is ever
 * invoked (those tests would shell out, so we only assert the env short-circuit
 * for claudeUserId).
 */

import { describe, expect, test, afterAll, beforeEach } from 'bun:test';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname;
const IDENT_JS = join(ROOT, 'dist', 'local-identity.js');

const tempRoots: string[] = [];
function freshDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'metro-ident-'));
  tempRoots.push(d);
  return d;
}
afterAll(() => {
  for (const d of tempRoots) try { rmSync(d, { recursive: true, force: true }); } catch { /* ignore */ }
});

/** Run one exported function from dist/local-identity.js in a fresh process. */
function runIdent(fn: string, env: Record<string, string>): { stdout: string; stderr: string; status: number } {
  const driver = `
    import * as m from ${JSON.stringify(IDENT_JS)};
    try { process.stdout.write(String(m[${JSON.stringify(fn)}]())); }
    catch (e) { process.stderr.write(e.message); process.exit(7); }
  `;
  const r = spawnSync('node', ['--input-type=module', '-e', driver], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH, ...env },
  });
  return { stdout: r.stdout, stderr: r.stderr, status: r.status ?? 0 };
}

describe('claudeUserId / codexUserId — METRO_USER_ID short-circuit', () => {
  test('claudeUserId returns METRO_USER_ID without invoking claude CLI', () => {
    const r = runIdent('claudeUserId', { METRO_USER_ID: 'org-123', METRO_STATE_DIR: freshDir() });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('org-123');
  });

  test('codexUserId returns METRO_USER_ID without reading auth.json', () => {
    const r = runIdent('codexUserId', { METRO_USER_ID: 'acct-9', METRO_STATE_DIR: freshDir(), CODEX_HOME: '/nonexistent' });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('acct-9');
  });
});

describe('codexUserId — auth.json resolution + error branches', () => {
  function withCodexHome(authContents: string | null): { stdout: string; stderr: string; status: number } {
    const root = freshDir();
    const codexHome = join(root, 'codex');
    mkdirSync(codexHome, { recursive: true });
    if (authContents !== null) writeFileSync(join(codexHome, 'auth.json'), authContents);
    /** METRO_USER_ID unset so the loader actually runs. */
    return runIdent('codexUserId', { CODEX_HOME: codexHome, METRO_STATE_DIR: join(root, 'state') });
  }

  test('reads tokens.account_id from a valid auth.json', () => {
    const r = withCodexHome(JSON.stringify({ tokens: { account_id: 'acct-from-file' }, auth_mode: 'chatgpt' }));
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('acct-from-file');
  });

  test('throws when auth.json is missing', () => {
    const r = withCodexHome(null);
    expect(r.status).toBe(7);
    expect(r.stderr).toContain('failed to read');
  });

  test('throws on non-JSON auth.json', () => {
    const r = withCodexHome('not json {');
    expect(r.status).toBe(7);
    expect(r.stderr).toContain('not valid JSON');
  });

  test('throws when account_id is absent (reports auth_mode)', () => {
    const r = withCodexHome(JSON.stringify({ auth_mode: 'apikey' }));
    expect(r.status).toBe(7);
    expect(r.stderr).toContain('no Codex account_id');
    expect(r.stderr).toContain('apikey');
  });
});

/* ── In-process: env-only / file-only resolvers (no memoization concerns) ── */

const SAVED: Record<string, string | undefined> = {};
const ENV_KEYS = ['METRO_USER_SESSION_ID', 'CLAUDE_CODE_SESSION_ID', 'METRO_USER_ID'];

beforeEach(() => {
  for (const k of ENV_KEYS) { SAVED[k] = process.env[k]; delete process.env[k]; }
});
afterAll(() => {
  for (const k of ENV_KEYS) { if (SAVED[k] === undefined) delete process.env[k]; else process.env[k] = SAVED[k]!; }
});

describe('claudeSessionId — env precedence', () => {
  test('METRO_USER_SESSION_ID wins', async () => {
    const { claudeSessionId } = await import('../src/local-identity.ts');
    process.env.METRO_USER_SESSION_ID = 'sess-A';
    process.env.CLAUDE_CODE_SESSION_ID = 'sess-B';
    expect(claudeSessionId()).toBe('sess-A');
  });

  test('falls back to CLAUDE_CODE_SESSION_ID', async () => {
    const { claudeSessionId } = await import('../src/local-identity.ts');
    process.env.CLAUDE_CODE_SESSION_ID = 'sess-B';
    expect(claudeSessionId()).toBe('sess-B');
  });

  test('null when neither set', async () => {
    const { claudeSessionId } = await import('../src/local-identity.ts');
    expect(claudeSessionId()).toBeNull();
  });
});

describe('codexSessionId / setCodexSessionId — env > file > null', () => {
  test('METRO_USER_SESSION_ID wins over the session file', async () => {
    const { codexSessionId, setCodexSessionId } = await import('../src/local-identity.ts');
    setCodexSessionId('file-thread');
    process.env.METRO_USER_SESSION_ID = 'env-thread';
    expect(codexSessionId()).toBe('env-thread');
  });

  test('reads the session file when env unset; setCodexSessionId round-trips', async () => {
    const { codexSessionId, setCodexSessionId } = await import('../src/local-identity.ts');
    setCodexSessionId('persisted-thread');
    expect(codexSessionId()).toBe('persisted-thread');
  });

  test('null after the file is cleared to empty', async () => {
    const { codexSessionId, setCodexSessionId } = await import('../src/local-identity.ts');
    setCodexSessionId(null);
    expect(codexSessionId()).toBeNull();
  });

  test('setCodexSessionId actually writes the state file', async () => {
    const { setCodexSessionId } = await import('../src/local-identity.ts');
    const { STATE_DIR } = await import('../src/paths.ts');
    setCodexSessionId('check-write');
    const f = join(STATE_DIR, 'codex-session-id');
    expect(existsSync(f)).toBe(true);
    expect(readFileSync(f, 'utf8').trim()).toBe('check-write');
  });
});
