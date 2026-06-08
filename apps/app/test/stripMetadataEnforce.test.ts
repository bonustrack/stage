/** Runtime companion to the compile-time strip guard (`lib/xmtp.stripGuard.ts`).
 *
 *  The ACTUAL bypass-proof guarantee is enforced by `tsc` via the type-level
 *  assertions in `lib/xmtp.stripGuard.ts` (which CI runs): the encrypt boundary
 *  `encryptSanitizedAttachment` accepts ONLY a branded `SanitizedFileUri`, and
 *  `sanitizeFileUri` is the sole producer of that brand. If the brand is removed
 *  or the boundary loosened to `string`, the app build fails.
 *
 *  This bun test documents that contract for humans and asserts the one thing
 *  observable at runtime: the brand is a PHANTOM with zero runtime footprint -
 *  a `SanitizedFileUri` is, at runtime, exactly its underlying string. So the
 *  enforcement is purely type-level and changes no behaviour vs PR #376.
 *
 *  What this does NOT prove: the on-disk strip rewrite running (no native/expo
 *  runtime here) - same honesty caveat as stripMetadata.test.ts. We use a
 *  `type`-only import so the native @xmtp / expo-file-system modules are never
 *  loaded into the bun runtime. */

import { describe, expect, test } from 'bun:test';
import type { SanitizedFileUri } from '../lib/xmtp.swarm';

describe('metadata-strip enforcement (runtime contract)', () => {
  test('SanitizedFileUri is a zero-cost phantom brand over string', () => {
    // The deliberate `as SanitizedFileUri` cast is the ONE documented escape
    // hatch the design allows: visible and greppable, so every bypass is
    // reviewable. There is no other way to obtain the type.
    const branded = 'file:///tmp/clean.jpg' as SanitizedFileUri;
    expect(typeof branded).toBe('string');
    expect(branded).toBe('file:///tmp/clean.jpg');
    expect(`${branded}/x`).toBe('file:///tmp/clean.jpg/x');
  });

  test('the compile-time guard module exists and is build-checked', () => {
    // lib/xmtp.stripGuard.ts holds the @ts-expect-error assertions that fail the
    // build if a raw string becomes acceptable at the encrypt boundary. We can't
    // re-run tsc from inside bun, so we assert the guard file is present in the
    // repo as the source of truth (a missing guard = a silent regression).
    const guard = Bun.file(new URL('../lib/xmtp.stripGuard.ts', import.meta.url).pathname);
    expect(guard.size).toBeGreaterThan(0);
  });
});
