
import { createRequire } from 'node:module';
import { describe, expect, test } from 'bun:test';
import { railgunMethodManifest, SDK_METHODS } from '@stage-labs/client/railgun';
import generated from '../nodejs-assets/nodejs-project/railgun-methods.json';

interface SdkDispatch {
  listMethods(): string[];
  assertWhitelistParity(): { ok: boolean; skipped: boolean; missingInHost: string[]; extraInHost: string[] };
}

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
