/** Anti-desync gate for the Railgun bridge method surface.
 *
 *  The method names live ONCE in the pure client contract
 *  (packages/client/src/railgun/methods.ts SDK_METHODS) and are projected to a
 *  JSON manifest (railgun-methods.json) the embedded Node host reads. Before
 *  phase 2 these names were duplicated as bare strings across the RN builders,
 *  the host whitelist, and the host engine-op routing; adding one and forgetting
 *  another shipped a primitive that only rejected at proof time on a real APK.
 *
 *  This test asserts, in CI:
 *    1. the generated manifest == the contract const (codegen not stale), and
 *    2. the Node host's WHITELIST keys == the manifest's sdkMethods (no drift).
 *  A failure here means run `node apps/app/scripts/gen-railgun-methods.mjs` and
 *  reconcile sdkDispatch.js - it CANNOT ship a silent runtime gap. */

import { createRequire } from 'node:module';
import { describe, expect, test } from 'bun:test';
import { railgunMethodManifest, SDK_METHODS } from '@stage-labs/client/railgun';
import generated from '../nodejs-assets/nodejs-project/railgun-methods.json';

/** The Node host whitelist module's public surface (plain CJS). */
interface SdkDispatch {
  listMethods(): string[];
  assertWhitelistParity(): { ok: boolean; skipped: boolean; missingInHost: string[]; extraInHost: string[] };
}

// The host whitelist is plain CJS (its requires of the native SDK are lazy, so
// loading it here does NOT pull in @railgun-community/wallet). Use createRequire
// to load the CJS module from this ESM test without the banned bare `require`.
const requireCjs = createRequire(import.meta.url);
const sdkDispatch = requireCjs('../nodejs-assets/nodejs-project/sdkDispatch.js') as SdkDispatch;

describe('railgun method contract parity', () => {
  test('generated manifest matches the contract const (codegen not stale)', () => {
    const want = railgunMethodManifest();
    expect(generated.sdkMethods).toEqual([...want.sdkMethods]);
    expect(generated.engineOps).toEqual([...want.engineOps]);
    expect(generated.compositeOps).toEqual([...want.compositeOps]);
  });

  test('contract has no duplicate method names', () => {
    expect(new Set(SDK_METHODS).size).toBe(SDK_METHODS.length);
  });

  test('host whitelist keys equal the contract sdkMethods (no desync)', () => {
    expect(sdkDispatch.listMethods()).toEqual([...generated.sdkMethods]);
  });

  test('host assertWhitelistParity reports in-sync', () => {
    const r = sdkDispatch.assertWhitelistParity();
    expect(r.ok).toBe(true);
    expect(r.skipped).toBe(false);
    expect(r.missingInHost).toEqual([]);
    expect(r.extraInHost).toEqual([]);
  });
});
