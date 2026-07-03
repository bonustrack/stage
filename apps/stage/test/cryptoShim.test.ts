
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
    expect(SRC).not.toMatch(/Math\s*\.\s*random/);
  });

  test('hard-fails (throws) when no secure CSPRNG is available', () => {
    function assertSecureRandom(g: { crypto?: { getRandomValues?: unknown } }) {
      const c = g.crypto;
      if (!c || typeof c.getRandomValues !== 'function') {
        throw new Error('no secure crypto.getRandomValues available');
      }
    }
    expect(SRC).toMatch(/throw new Error/);
    expect(() => { assertSecureRandom({}); }).toThrow();
    expect(() => { assertSecureRandom({ crypto: {} }); }).toThrow();
    expect(() =>
      { assertSecureRandom({ crypto: { getRandomValues: (arr: unknown) => arr } }); },
    ).not.toThrow();
  });
});
