/**
 * Tests for `metro account` (src/cli/account.ts): import validation + atomic
 * 0600 write, duplicate refusal, and the on-disk list fallback (daemon down).
 */

import { describe, expect, test, beforeEach, afterEach, mock } from 'bun:test';
import { mkdtempSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// Isolate from any live daemon: force the on-disk fallback path so `account
// list` reads only the tmp accounts files (otherwise ipcCall reaches the host
// metro.sock and the test passes/fails depending on whether a daemon is up).
mock.module('../src/ipc.js', () => ({
  ipcCall: () => Promise.reject(new Error('daemon down (test)')),
}));
import { cmdAccount } from '../src/cli/account.js';

const mode = (p: string): number => statSync(p).mode & 0o777;
// A valid secp256k1 key (well within range).
const KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';

let dir = '';
let xmtpFile = '';
const KEYS = ['XMTP_ACCOUNTS_FILE', 'DISCORD_ACCOUNTS_FILE', 'TELEGRAM_ACCOUNTS_FILE', 'XMTP_MNEMONIC_FILE'];
let saved: Record<string, string | undefined> = {};

/** Capture everything written to stdout during fn(). */
async function capture(fn: () => Promise<void> | void): Promise<string> {
  const orig = process.stdout.write.bind(process.stdout);
  let out = '';
  // @ts-expect-error narrow override for the test
  process.stdout.write = (chunk: string): boolean => { out += chunk; return true; };
  try { await fn(); } finally { process.stdout.write = orig; }
  return out;
}

beforeEach(() => {
  saved = {};
  for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  dir = mkdtempSync(join(tmpdir(), 'metro-acct-'));
  xmtpFile = join(dir, 'xmtp-accounts.json');
  process.env.XMTP_ACCOUNTS_FILE = xmtpFile;
  process.env.DISCORD_ACCOUNTS_FILE = join(dir, 'discord-accounts.json');
  process.env.TELEGRAM_ACCOUNTS_FILE = join(dir, 'telegram-accounts.json');
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
  }
});

describe('account import', () => {
  test('imports a valid key, writes 0600, content is the new entry', async () => {
    await capture(() => cmdAccount(['import', 'xmtp', KEY], { id: 'fresh' }));
    expect(mode(xmtpFile)).toBe(0o600);
    const parsed = JSON.parse(readFileSync(xmtpFile, 'utf8'));
    expect(parsed).toEqual([{ id: 'fresh', privateKey: KEY }]);
  });

  test('appends without disturbing existing entries', async () => {
    writeFileSync(xmtpFile, JSON.stringify([{ id: 'tony', derive: 0 }]));
    await capture(() => cmdAccount(['import', 'xmtp', KEY], { id: 'fresh' }));
    const parsed = JSON.parse(readFileSync(xmtpFile, 'utf8'));
    expect(parsed).toEqual([{ id: 'tony', derive: 0 }, { id: 'fresh', privateKey: KEY }]);
  });

  test('rejects a malformed key', async () => {
    await expect(cmdAccount(['import', 'xmtp', '0xdeadbeef'], { id: 'x' }))
      .rejects.toThrow(/invalid private key/);
  });

  test('rejects a key out of secp256k1 range', async () => {
    const tooBig = '0x' + 'f'.repeat(64);
    await expect(cmdAccount(['import', 'xmtp', tooBig], { id: 'x' }))
      .rejects.toThrow(/secp256k1 range/);
  });

  test('refuses a duplicate id', async () => {
    writeFileSync(xmtpFile, JSON.stringify([{ id: 'dup', derive: 1 }]));
    await expect(cmdAccount(['import', 'xmtp', KEY], { id: 'dup' }))
      .rejects.toThrow(/already exists/);
  });

  test('refuses a duplicate private key', async () => {
    writeFileSync(xmtpFile, JSON.stringify([{ id: 'a', privateKey: KEY }]));
    await expect(cmdAccount(['import', 'xmtp', KEY], { id: 'b' }))
      .rejects.toThrow(/already imported/);
  });

  test('requires --id', async () => {
    await expect(cmdAccount(['import', 'xmtp', KEY], {})).rejects.toThrow(/--id/);
  });

  test('only xmtp supports import', async () => {
    await expect(cmdAccount(['import', 'discord', KEY], { id: 'x' }))
      .rejects.toThrow(/only supported for the xmtp/);
  });
});

describe('account list (disk fallback, daemon down)', () => {
  test('lists accounts with keySource, no address offline', async () => {
    writeFileSync(xmtpFile, JSON.stringify([
      { id: 'tony', derive: 0, owner: 'metro://claude/user/a' },
      { id: 'imported', privateKey: KEY },
    ]));
    const out = await capture(() => cmdAccount(['list', 'xmtp'], { json: true }));
    const { accounts } = JSON.parse(out);
    expect(accounts).toEqual([
      { id: 'tony', station: 'xmtp', address: null, keySource: 'derive:0', owner: 'metro://claude/user/a' },
      { id: 'imported', station: 'xmtp', address: null, keySource: 'privateKey', owner: null },
    ]);
  });

  test('empty when no files exist', async () => {
    const out = await capture(() => cmdAccount(['list'], { json: true }));
    expect(JSON.parse(out)).toEqual({ accounts: [] });
  });
});
