/** DEVICE-BOUND SECRET STORAGE INVARIANT (security regression test).
 *
 *  Every raw secret this app persists in expo-secure-store — per-account
 *  secp256k1 private keys, the app BIP-39 mnemonic, and the AES key that
 *  encrypts the on-device XMTP message store — MUST be written with
 *  `keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY` (the modules' shared
 *  `STORE_OPTS`).
 *
 *  Why this matters: expo-secure-store's DEFAULT accessibility is
 *  `AFTER_FIRST_UNLOCK`, which on iOS is eligible for iCloud Keychain sync and
 *  inclusion in encrypted device backups. A secret written without the
 *  device-only flag can therefore leave the device — an attacker with a backup
 *  (or a restored/second device) can recover a raw private key (full wallet
 *  drain) or the XMTP db key (decrypt the entire message history off-device).
 *
 *  A previous revision shipped exactly this bug: the keyring's legacy->per-
 *  account self-heal write (`loadPrivateKey`) and BOTH `xmtp.dbkey.ts` writes
 *  (legacy-adopt + fresh-mint) called `setItemAsync(...)` with NO options
 *  object, silently downgrading those secrets to backup-eligible storage and
 *  violating the at-rest boundary documented in keyring.ts note 6 and
 *  SECURITY.md.
 *
 *  This test pins, against source text, that NO `setItemAsync` call in the
 *  secret-bearing modules is missing its options argument. We assert against
 *  source (like keyring.guard.test.ts / cryptoShim.test.ts) because importing
 *  these modules under bun/node pulls in `expo-secure-store` / `react-native`,
 *  which are unresolvable outside the RN runtime. */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';

const APP_ROOT = join(import.meta.dir, '..');
const KEYRING = join(APP_ROOT, 'lib', 'zerodev', 'keyring.ts');
const DBKEY = join(APP_ROOT, 'lib', 'xmtp.dbkey.ts');

/** Strip /* *​/ block comments and // line comments so the call-site regexes
 *  match real code only (a banned shape mentioned in a comment is not a bug). */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/** Find every `SecureStore.setItemAsync(` call (across newlines) and return its
 *  raw argument list up to the matching close paren — enough to assert whether
 *  a 3rd "options" argument is present. */
function setItemCalls(src: string): string[] {
  const code = stripComments(src);
  const calls: string[] = [];
  const re = /SecureStore\.setItemAsync\s*\(/g;
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

/** A setItemAsync call is device-bound iff its 3rd argument is one of the shared
 *  device-bound option consts. `STORE_OPTS` and `SENTINEL_OPTS` are both pinned
 *  to `WHEN_UNLOCKED_THIS_DEVICE_ONLY` (the third test below asserts that), so a
 *  call passing either is device-bound. The modules pass a named const (not an
 *  inline object), so exact token match is sufficient. */
const DEVICE_BOUND_OPTS = new Set(['STORE_OPTS', 'SENTINEL_OPTS']);
function isDeviceBound(args: string): boolean {
  // crude arg split on top-level commas (no nested objects/calls in these sites)
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
    test(`${label}: every setItemAsync passes STORE_OPTS`, () => {
      const src = readFileSync(path, 'utf8');
      const calls = setItemCalls(src);
      expect(calls.length).toBeGreaterThan(0); // guard: sites still exist
      const offenders = calls.filter((c) => !isDeviceBound(c));
      expect(offenders).toEqual([]);
    });
  }

  test('both modules define STORE_OPTS as WHEN_UNLOCKED_THIS_DEVICE_ONLY', () => {
    for (const path of [KEYRING, DBKEY]) {
      const src = readFileSync(path, 'utf8');
      expect(src).toMatch(
        /STORE_OPTS[\s\S]{0,160}keychainAccessible:\s*SecureStore\.WHEN_UNLOCKED_THIS_DEVICE_ONLY/,
      );
    }
  });

  test('keyring self-heal write is device-bound (regression: PK backup leak)', () => {
    const src = stripComments(readFileSync(KEYRING, 'utf8'));
    // The self-heal re-write lives right after the address-derivation check.
    expect(src).toMatch(
      /privateKeyToAccount\(norm\)[\s\S]{0,200}setItemAsync\(\s*PK_PREFIX \+ id,\s*norm,\s*STORE_OPTS\)/,
    );
    // And must NOT contain the vulnerable 2-arg form for that write.
    expect(src).not.toMatch(/setItemAsync\(\s*PK_PREFIX \+ id,\s*norm\)\s*\.catch/);
  });

  test('xmtp.dbkey writes (adopt + fresh) are device-bound (regression: db-key backup leak)', () => {
    const src = stripComments(readFileSync(DBKEY, 'utf8'));
    expect(src).toMatch(/setItemAsync\(\s*id,\s*legacy,\s*STORE_OPTS\)/);
    expect(src).toMatch(/setItemAsync\(\s*id,\s*encodeKey\(fresh\),\s*STORE_OPTS\)/);
    // Vulnerable 2-arg forms must be gone.
    expect(src).not.toMatch(/setItemAsync\(\s*id,\s*legacy\)\s*\.catch/);
    expect(src).not.toMatch(/setItemAsync\(\s*id,\s*encodeKey\(fresh\)\)\s*;/);
  });
});
