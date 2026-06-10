/** Unit tests for `--from` outbound routing (resolveFrom).
 *
 * #1 invariant (no-regression): with NO `--from` flag and NO sessions.json,
 * resolveFrom returns undefined for every line/verb, so `env.account` stays
 * unset and the daemon routes exactly as it does today. Verified explicitly. */

import { describe, expect, test, afterEach, afterAll } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Flags } from '../src/cli/util.ts';

// Neutralize ambient CLI-session env so `activeSessionId()` is driven only by
// METRO_SESSION within each test (deterministic regardless of the test host).
const savedClaude = process.env.CLAUDECODE;
delete process.env.CLAUDECODE;
afterAll(() => { if (savedClaude !== undefined) process.env.CLAUDECODE = savedClaude; });

const tempRoots: string[] = [];
function withSessionsFile(contents: string | null): void {
  const dir = mkdtempSync(join(tmpdir(), 'metro-from-'));
  tempRoots.push(dir);
  const file = join(dir, 'sessions.json');
  if (contents !== null) writeFileSync(file, contents);
  process.env.METRO_SESSIONS_FILE = file;
}
afterEach(() => {
  delete process.env.METRO_SESSIONS_FILE;
  delete process.env.METRO_SESSION;
  for (const d of tempRoots.splice(0)) try { rmSync(d, { recursive: true, force: true }); } catch { /* ignore */ }
});

async function mod() { return import('../src/cli/from.ts'); }

const XMTP = 'metro://xmtp/default/conv1';
const DISCORD = 'metro://discord/12345';
const NO_FLAGS: Flags = {};

describe('no-regression (SAFETY INVARIANT)', () => {
  test('no --from + no sessions.json → undefined (account stays unset)', async () => {
    withSessionsFile(null);
    const { resolveFrom } = await mod();
    expect(resolveFrom(XMTP, NO_FLAGS)).toBeUndefined();
    expect(resolveFrom(DISCORD, NO_FLAGS)).toBeUndefined();
  });
  test('no --from, sessions.json present but no active session → undefined', async () => {
    withSessionsFile(JSON.stringify({ alpha: { xmtp: 'work' } }));
    const { resolveFrom } = await mod();
    expect(resolveFrom(XMTP, NO_FLAGS)).toBeUndefined();
  });
  test('active session with NO binding → undefined (falls back to today)', async () => {
    withSessionsFile(JSON.stringify({ alpha: { xmtp: 'work' } }));
    process.env.METRO_SESSION = 'unknown-session';
    const { resolveFrom } = await mod();
    expect(resolveFrom(XMTP, NO_FLAGS)).toBeUndefined();
  });
});

describe('explicit --from', () => {
  test('literal account id passes through verbatim (no sessions.json)', async () => {
    withSessionsFile(null);
    const { resolveFrom } = await mod();
    expect(resolveFrom(XMTP, { from: 'work' })).toBe('work');
  });
  test('matching session id resolves via its xmtp binding', async () => {
    withSessionsFile(JSON.stringify({ alpha: { xmtp: 'work-acct' } }));
    const { resolveFrom } = await mod();
    expect(resolveFrom(XMTP, { from: 'alpha' })).toBe('work-acct');
  });
  test('session falls back to its default binding when xmtp unmapped', async () => {
    withSessionsFile(JSON.stringify({ alpha: { default: 'fallback-acct' } }));
    const { resolveFrom } = await mod();
    expect(resolveFrom(XMTP, { from: 'alpha' })).toBe('fallback-acct');
  });
  test('name not in sessions.json is treated as a literal account id', async () => {
    withSessionsFile(JSON.stringify({ alpha: { xmtp: 'work-acct' } }));
    const { resolveFrom } = await mod();
    expect(resolveFrom(XMTP, { from: 'raw-account' })).toBe('raw-account');
  });
  test('--from on a non-xmtp station passes through literally (inert binding)', async () => {
    withSessionsFile(JSON.stringify({ alpha: { discord: 'd-acct' } }));
    const { resolveFrom } = await mod();
    // discord binds 1:1; --from is literal pass-through, never a session lookup.
    expect(resolveFrom(DISCORD, { from: 'alpha' })).toBe('alpha');
  });
});

describe('active-session binding (no explicit --from)', () => {
  test('active session resolves its xmtp account for an xmtp line', async () => {
    withSessionsFile(JSON.stringify({ alpha: { xmtp: 'work-acct' } }));
    process.env.METRO_SESSION = 'alpha';
    const { resolveFrom } = await mod();
    expect(resolveFrom(XMTP, NO_FLAGS)).toBe('work-acct');
  });
  test('active-session binding does NOT apply to a non-xmtp line', async () => {
    withSessionsFile(JSON.stringify({ alpha: { xmtp: 'work-acct', discord: 'd' } }));
    process.env.METRO_SESSION = 'alpha';
    const { resolveFrom } = await mod();
    expect(resolveFrom(DISCORD, NO_FLAGS)).toBeUndefined();
  });
  test('explicit --from overrides the active-session binding', async () => {
    withSessionsFile(JSON.stringify({ alpha: { xmtp: 'work-acct' }, beta: { xmtp: 'beta-acct' } }));
    process.env.METRO_SESSION = 'alpha';
    const { resolveFrom } = await mod();
    expect(resolveFrom(XMTP, { from: 'beta' })).toBe('beta-acct');
  });
});
