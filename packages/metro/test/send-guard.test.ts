/**
 * Tests for the per-session SEND-GUARD (src/cli/send-guard.ts): a metro CLI may
 * only send XMTP on an account its OWN session owns. Lean-toward-allow when the
 * caller station or the account owner can't be determined.
 */

import { describe, expect, test, beforeEach, afterEach, afterAll } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { enforceSendGuard } from '../src/cli/send-guard.js';

const tempRoots: string[] = [];
let ACCOUNTS = '';

/** Account map: tony→claude, codex→codex, orphan→no owner. */
const ACCOUNTS_JSON = JSON.stringify([
  { id: 'tony', owner: 'metro://claude/user/abc' },
  { id: 'codex', owner: 'metro://codex/user/def' },
  { id: 'orphan' },
]);

/** Env keys the guard reads — cleared/restored around each test. */
const KEYS = ['CLAUDECODE', 'METRO_CODEX_RC', 'CODEX_HOME', 'METRO_ALLOW_CROSS_ACCOUNT', 'XMTP_ACCOUNTS_FILE'];
let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = {};
  for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  const d = mkdtempSync(join(tmpdir(), 'metro-guard-'));
  tempRoots.push(d);
  ACCOUNTS = join(d, 'xmtp-accounts.json');
  writeFileSync(ACCOUNTS, ACCOUNTS_JSON);
  process.env.XMTP_ACCOUNTS_FILE = ACCOUNTS;
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

afterAll(() => {
  for (const d of tempRoots) { try { rmSync(d, { recursive: true, force: true }); } catch { /* ignore */ } }
});

const send = (args: unknown): void => enforceSendGuard('xmtp', 'send', args);

describe('send-guard', () => {
  test('REJECTS codex session sending on tony (claude-owned) account via line', () => {
    process.env.METRO_CODEX_RC = '/some/rc';
    expect(() => send({ line: 'metro://xmtp/tony/conv1', text: 'hi' })).toThrow(/refusing to send on account 'tony'/);
  });

  test('REJECTS via explicit account arg too', () => {
    process.env.CODEX_HOME = '/home/.codex';
    expect(() => send({ account: 'tony', line: 'metro://xmtp/tony/conv1', text: 'hi' })).toThrow(/owned by claude/);
  });

  test('ALLOWS codex session sending on its own codex account', () => {
    process.env.METRO_CODEX_RC = '/some/rc';
    expect(() => send({ line: 'metro://xmtp/codex/conv1', text: 'hi' })).not.toThrow();
  });

  test('ALLOWS claude session sending on tony (claude-owned) account', () => {
    process.env.CLAUDECODE = '1';
    expect(() => send({ line: 'metro://xmtp/tony/conv1', text: 'hi' })).not.toThrow();
  });

  test('ALLOWS when caller station is unknown (human/admin, no env set)', () => {
    expect(() => send({ line: 'metro://xmtp/tony/conv1', text: 'hi' })).not.toThrow();
  });

  test('ALLOWS when target account has no owner', () => {
    process.env.METRO_CODEX_RC = '/some/rc';
    expect(() => send({ line: 'metro://xmtp/orphan/conv1', text: 'hi' })).not.toThrow();
  });

  test('ALLOWS when account is not in the accounts file', () => {
    process.env.METRO_CODEX_RC = '/some/rc';
    expect(() => send({ line: 'metro://xmtp/unknown/conv1', text: 'hi' })).not.toThrow();
  });

  test('ALLOWS when accounts file is missing', () => {
    process.env.METRO_CODEX_RC = '/some/rc';
    process.env.XMTP_ACCOUNTS_FILE = join(tmpdir(), 'does-not-exist-12345.json');
    expect(() => send({ line: 'metro://xmtp/tony/conv1', text: 'hi' })).not.toThrow();
  });

  test('escape hatch METRO_ALLOW_CROSS_ACCOUNT=1 bypasses the guard', () => {
    process.env.METRO_CODEX_RC = '/some/rc';
    process.env.METRO_ALLOW_CROSS_ACCOUNT = '1';
    expect(() => send({ line: 'metro://xmtp/tony/conv1', text: 'hi' })).not.toThrow();
  });

  test('only guards xmtp outbound actions — other trains/actions pass through', () => {
    process.env.METRO_CODEX_RC = '/some/rc';
    expect(() => enforceSendGuard('discord', 'send', { line: 'metro://discord/123', text: 'x' })).not.toThrow();
    expect(() => enforceSendGuard('xmtp', 'query', { line: 'metro://xmtp/tony/conv1' })).not.toThrow();
    expect(() => enforceSendGuard('xmtp', 'accounts', {})).not.toThrow();
  });

  test('guards reply/react/sendAttachment/newDm/newGroup as well as send', () => {
    process.env.METRO_CODEX_RC = '/some/rc';
    for (const action of ['reply', 'react', 'sendAttachment']) {
      expect(() => enforceSendGuard('xmtp', action, { line: 'metro://xmtp/tony/c', text: 'x' }))
        .toThrow(/refusing to send/);
    }
    expect(() => enforceSendGuard('xmtp', 'newDm', { account: 'tony', address: '0x1' })).toThrow(/refusing to send/);
    expect(() => enforceSendGuard('xmtp', 'newGroup', { account: 'tony', addresses: ['0x1'] })).toThrow(/refusing to send/);
  });

  test('legacy single-segment line maps to the default account', () => {
    process.env.METRO_CODEX_RC = '/some/rc';
    writeFileSync(ACCOUNTS, JSON.stringify([{ id: 'default', owner: 'metro://claude/user/abc' }]));
    expect(() => send({ line: 'metro://xmtp/conv1', text: 'hi' })).toThrow(/account 'default'/);
  });
});
