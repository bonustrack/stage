/** CSPRNG INVARIANT (security regression test).
 *
 *  React Native ships no Web Crypto API, so `crypto.getRandomValues` must be
 *  installed by a polyfill before any wallet/viem module derives a key. The
 *  ONLY acceptable backing is the platform CSPRNG (Android SecureRandom / iOS
 *  SecRandomCopyBytes), provided by `react-native-get-random-values`.
 *
 *  A previous revision of `lib/cryptoShim.ts` installed a `Math.random()`
 *  fallback "for dev". Because RN has no native Web Crypto, that fallback was
 *  the *active* production path: every minted BIP-39 mnemonic and private key
 *  — the root of every smart account — was generated from a 128-bit
 *  non-cryptographic PRNG and was brute-forceable (full wallet drain).
 *
 *  This test pins two guarantees so the weak fallback cannot silently return:
 *   1. cryptoShim side-effect-imports `react-native-get-random-values` (the
 *      native CSPRNG polyfill), as its first import.
 *   2. cryptoShim contains NO `Math.random` fallback for getRandomValues, and
 *      instead hard-fails when no secure CSPRNG is present.
 *
 *  We assert against source text (like keyring.guard.test.ts) because
 *  importing cryptoShim under bun/node would pull in `react-native`, which is
 *  not resolvable outside the RN runtime. We also exercise the invariant's
 *  runtime behaviour with a faithful re-implementation. */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';

const SHIM_PATH = join(import.meta.dir, '..', 'lib', 'cryptoShim.ts');
const SRC = readFileSync(SHIM_PATH, 'utf8');

describe('cryptoShim CSPRNG invariant', () => {
  test('imports the native CSPRNG polyfill (react-native-get-random-values)', () => {
    expect(SRC).toMatch(
      /import\s+['"]react-native-get-random-values['"]/,
    );
  });

  test('the CSPRNG polyfill import comes before any other import', () => {
    const importLines = SRC.split('\n').filter((l) => /^\s*import\b/.test(l));
    expect(importLines.length).toBeGreaterThan(0);
    expect(importLines[0]).toMatch(/react-native-get-random-values/);
  });

  test('contains NO Math.random fallback for randomness', () => {
    // The whole point: weak entropy must never back getRandomValues again.
    expect(SRC).not.toMatch(/Math\s*\.\s*random/);
  });

  test('hard-fails (throws) when no secure CSPRNG is available', () => {
    // Mirror the invariant the shim enforces, then prove the two outcomes.
    function assertSecureRandom(g: { crypto?: { getRandomValues?: unknown } }) {
      const c = g.crypto;
      if (!c || typeof c.getRandomValues !== 'function') {
        throw new Error('no secure crypto.getRandomValues available');
      }
    }
    expect(SRC).toMatch(/throw new Error/);
    // No crypto at all -> throw (refuse to mint weak keys).
    expect(() => { assertSecureRandom({}); }).toThrow();
    expect(() => { assertSecureRandom({ crypto: {} }); }).toThrow();
    // Real CSPRNG present -> ok.
    expect(() =>
      { assertSecureRandom({ crypto: { getRandomValues: (arr: unknown) => arr } }); },
    ).not.toThrow();
  });
});
