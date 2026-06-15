/** PASSKEY-ONLY SIGNER INVARIANT (Less's hard requirement).
 *
 *  GOAL: when an account record has `rec.passkey`, EVERY signature (tx, message,
 *  typedData, userOp, and the XMTP SCW signer) is produced by the PASSKEY
 *  validator and the ECDSA/mnemonic key is NEVER read or used for signing.
 *
 *  The passkey + ZeroDev SDK + WebAuthn paths only run on-device (native
 *  modules), so we cannot exercise the real signer in CI. Instead this test
 *  pins the SOURCE-LEVEL invariants of the central chokepoint
 *  (lib/zerodev/kernelForRecord.ts) so the regression "the key signs while a
 *  passkey exists" can't silently come back:
 *
 *    1. On the passkey branch the Kernel is built from the PASSKEY validator
 *       (passkeyKernelFromStored) only.
 *    2. On the passkey branch the mnemonic-derived owner (smartOwnerSigner) is
 *       NOT read before the passkey kernel is built (so the key is not touched).
 *    3. If the passkey validator can't be built AND the native module is
 *       present, we THROW rather than silently signing with the ECDSA key.
 *    4. The account builder keeps sudo=passkey with NO regular ECDSA validator
 *       (plugins: { sudo: passkeyValidator } only).
 *
 *  Pairs with keyring.guard.test.ts (key material chokepoint). */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';

const APP_ROOT = join(import.meta.dir, '..');
const KERNEL_FOR_RECORD = join(APP_ROOT, 'lib', 'zerodev', 'kernelForRecord.ts');
const ACCOUNT = join(APP_ROOT, 'lib', 'zerodev', 'account.ts');

const kernelSrc = readFileSync(KERNEL_FOR_RECORD, 'utf8');
const accountSrc = readFileSync(ACCOUNT, 'utf8');

/** The body of kernelClientForRecord, used for ordering assertions. */
function bodyOf(src: string, fn: string): string {
  const i = src.indexOf(`export async function ${fn}`);
  expect(i).toBeGreaterThanOrEqual(0);
  return src.slice(i);
}

describe('passkey-only signer (kernelForRecord chokepoint)', () => {
  const body = bodyOf(kernelSrc, 'kernelClientForRecord');

  test('passkey branch builds the Kernel from the passkey validator', () => {
    // The passkey branch must call passkeyKernelFromStored, and the passkey path
    // must come BEFORE any ECDSA owner derivation in the function.
    const passkeyCall = body.indexOf('passkeyKernelFromStored');
    expect(passkeyCall).toBeGreaterThanOrEqual(0);
    // The branch is guarded on rec.passkey.
    expect(body).toContain('if (rec.passkey)');
  });

  test('mnemonic is NOT read before the passkey kernel is built', () => {
    // smartOwnerSigner (the mnemonic-reading owner derivation) must NOT appear
    // before the passkey kernel is built on the passkey path. The first
    // smartOwnerSigner reference must come after the passkey build returns.
    const passkeyBuild = body.indexOf('passkeyKernelFromStored');
    const firstOwnerRead = body.indexOf('smartOwnerSigner');
    expect(passkeyBuild).toBeGreaterThanOrEqual(0);
    expect(firstOwnerRead).toBeGreaterThan(passkeyBuild);
  });

  test('passkey account fails closed (throws) instead of signing with the key', () => {
    // When passkeysAvailable() is true but the passkey kernel could not be built,
    // we must throw rather than fall back to createEcdsaKernel for a passkey acct.
    expect(body).toContain('if (passkeysAvailable())');
    expect(body).toMatch(/throw new Error\([^)]*refusing to sign with the ECDSA key/);
  });

  test('passkey kernel is rebuilt address-pinned (counterfactual + deployed)', () => {
    // rec.address is passed as the addressOverride so the rebuilt passkey-sudo
    // Kernel resolves to the SAME identity whether counterfactual or deployed.
    expect(body).toContain('rec.address as `0x${string}`');
  });
});

describe('passkey validator is the sole active plugin (account.ts)', () => {
  test('buildPasskeyKernel uses sudo=passkey with NO regular validator', () => {
    const i = accountSrc.indexOf('async function buildPasskeyKernel');
    const j = accountSrc.indexOf('async function passkeyValidatorFromStored');
    // Strip line + block comments so prose ("NO regular") doesn't false-match.
    const block = accountSrc
      .slice(i, j)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    // sudo is the passkey validator.
    expect(block).toContain('plugins: { sudo: passkeyValidator }');
    // No `regular:` plugin in the actual passkey kernel construction code.
    expect(block).not.toMatch(/regular\s*:/);
    // The ECDSA validator is never built on the passkey kernel path.
    expect(block).not.toContain('signerToEcdsaValidator');
  });
});
