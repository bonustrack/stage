
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';

const APP_ROOT = join(import.meta.dir, '..');
const KEYRING = join(APP_ROOT, 'lib', 'zerodev', 'keyring.ts');
const DBKEY = join(APP_ROOT, 'lib', 'xmtp.dbkey.ts');
const NATIVE_STORAGE = join(APP_ROOT, 'platform', 'storage.ts');

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

function setCalls(src: string): string[] {
  const code = stripComments(src);
  const calls: string[] = [];
  const re = /secureStorage\.set\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    for (; i < code.length && depth > 0; i++) {
      if (code[i] === '(') depth++;
      else if (code[i] === ')') depth--;
    }
    calls.push(code.slice(start, i - 1));
  }
  return calls;
}

const DEVICE_BOUND_OPTS = new Set(['STORE_OPTS', 'SENTINEL_OPTS']);
function isDeviceBound(args: string): boolean {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of args) {
    if (ch === '(' || ch === '{' || ch === '[') depth++;
    else if (ch === ')' || ch === '}' || ch === ']') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  const third = parts[2]?.trim() ?? '';
  return DEVICE_BOUND_OPTS.has(third);
}

describe('device-bound secret storage', () => {
  for (const [label, path] of [
    ['keyring (private keys + mnemonic)', KEYRING],
    ['xmtp.dbkey (store-encryption key)', DBKEY],
  ] as const) {
    test(`${label}: every secureStorage.set passes STORE_OPTS`, () => {
      const src = readFileSync(path, 'utf8');
      const calls = setCalls(src);
      expect(calls.length).toBeGreaterThan(0);
      const offenders = calls.filter((c) => !isDeviceBound(c));
      expect(offenders).toEqual([]);
    });
  }

  test('both modules define STORE_OPTS as thisDeviceOnly', () => {
    for (const path of [KEYRING, DBKEY]) {
      const src = readFileSync(path, 'utf8');
      expect(src).toMatch(
        /STORE_OPTS[\s\S]{0,160}thisDeviceOnly:\s*true/,
      );
    }
  });

  test('native storage maps thisDeviceOnly to WHEN_UNLOCKED_THIS_DEVICE_ONLY', () => {
    const src = stripComments(readFileSync(NATIVE_STORAGE, 'utf8'));
    expect(src).toMatch(
      /thisDeviceOnly[\s\S]{0,160}keychainAccessible\s*=\s*SecureStore\.WHEN_UNLOCKED_THIS_DEVICE_ONLY/,
    );
  });

  test('keyring self-heal write is device-bound (regression: PK backup leak)', () => {
    const src = stripComments(readFileSync(KEYRING, 'utf8'));
    expect(src).toMatch(
      /privateKeyToAccount\(norm\)[\s\S]{0,200}secureStorage\.set\(\s*PK_PREFIX \+ id,\s*norm,\s*STORE_OPTS\)/,
    );
    expect(src).not.toMatch(/secureStorage\.set\(\s*PK_PREFIX \+ id,\s*norm\)\s*\.catch/);
  });

  test('xmtp.dbkey writes (adopt + fresh) are device-bound (regression: db-key backup leak)', () => {
    const src = stripComments(readFileSync(DBKEY, 'utf8'));
    expect(src).toMatch(/secureStorage\.set\(\s*id,\s*legacy,\s*STORE_OPTS\)/);
    expect(src).toMatch(/secureStorage\.set\(\s*id,\s*encodeKey\(fresh\),\s*STORE_OPTS\)/);
    expect(src).not.toMatch(/secureStorage\.set\(\s*id,\s*legacy\)\s*\.catch/);
    expect(src).not.toMatch(/secureStorage\.set\(\s*id,\s*encodeKey\(fresh\)\)\s*;/);
  });

  for (const [label, path] of [
    ['keyring', KEYRING],
    ['xmtp.dbkey', DBKEY],
  ] as const) {
    test(`${label}: every secureStorage.get passes a device-bound options const`, () => {
      const code = stripComments(readFileSync(path, 'utf8'));
      const re = /secureStorage\.get\s*\(([^;]*?)\)\s*\.catch/g;
      const offenders: string[] = [];
      let m: RegExpExecArray | null;
      while ((m = re.exec(code)) !== null) {
        const args = m[1];
        const hasOpts = [...DEVICE_BOUND_OPTS].some((o) => args.includes(o));
        if (!hasOpts) offenders.push(m[0].trim());
      }
      expect(offenders).toEqual([]);
    });
  }
});
