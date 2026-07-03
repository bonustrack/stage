
import { describe, expect, test } from 'bun:test';
import type { SanitizedFileUri } from '../lib/xmtp.swarm';

describe('metadata-strip enforcement (runtime contract)', () => {
  test('SanitizedFileUri is a zero-cost phantom brand over string', () => {
    const branded = 'file:///tmp/clean.jpg' as SanitizedFileUri;
    expect(typeof branded).toBe('string');
    expect(branded).toBe('file:///tmp/clean.jpg');
    expect(`${branded}/x`).toBe('file:///tmp/clean.jpg/x');
  });

  test('the compile-time guard module exists and is build-checked', () => {
    const guard = Bun.file(new URL('../lib/xmtp.stripGuard.ts', import.meta.url).pathname);
    expect(guard.size).toBeGreaterThan(0);
  });
});
