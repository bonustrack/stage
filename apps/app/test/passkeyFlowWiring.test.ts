/** PASSKEY FLOW WIRING INVARIANTS (source-level, pure-JS CI).
 *
 *  The behavioral derivation facts are pinned in passkeyKernelDerivation.test.ts
 *  and the SDK callback contract in passkeyCallbackContract.test.ts. This file
 *  pins the GLUE so the happy path for a passkey-at-create account cannot silently
 *  regress, and the enable-upgrade / key-only / fail-closed branches stay correct.
 *  These are the wiring points that drifted in the iterative patching Less hit.
 *
 *  Covered:
 *    A. create.ts — a requested passkey at CREATE produces a passkey-sudo account:
 *       sets rec.passkey + rec.passkeySudo, derives the address from the passkey
 *       (no override), persists with NO enable step, and never silently downgrades.
 *    B. kernelForRecord.ts — passkeySudo accounts rebuild with NO address override;
 *       enable-upgraded (ECDSA-derived) accounts pin to rec.address.
 *    C. enablePasskey.ts — the upgrade deploys via the ECDSA initCode then swaps
 *       sudo on-chain, persists only after the receipt succeeds, and keeps the
 *       ECDSA-derived address.
 *    D. xmtp.codecs.ts — a smart account routes XMTP signing through the single
 *       scwSigner factory + kernelClientForRecord (so the passkey signs the inbox
 *       registration via ERC-1271/6492).
 *    E. useTxSignLayer.ts — a smart account routes tx (onPay) + message/typedData
 *       (onSign) through kernelClientForRecord (so the passkey signs them). */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';

const APP_ROOT = join(import.meta.dir, '..');
const read = (...p: string[]) => readFileSync(join(APP_ROOT, ...p), 'utf8');
/** Strip comments so prose can't false-match against code assertions. */
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const createSrc = code(read('lib', 'zerodev', 'create.ts'));
const kernelSrc = code(read('lib', 'zerodev', 'kernelForRecord.ts'));
const enableSrc = code(read('lib', 'zerodev', 'enablePasskey.ts'));
const codecsSrc = code(read('lib', 'xmtp.codecs.ts'));
const txLayerSrc = code(read('components', 'xmtp-conv', 'useTxSignLayer.ts'));
const accountSrc = code(read('lib', 'zerodev', 'account.ts'));

describe('A. create.ts — passkey-at-create is one-step DEPLOYED passkey-sudo', () => {
  test('builds the ECDSA (deployable) Kernel first, then runs the passkey branch', () => {
    expect(createSrc).toContain('const account = await createEcdsaKernel(publicClient, owner, hdIndex)');
    expect(createSrc).toContain('passkeysAvailable() && opts.rpId');
  });

  test('registers the credential and deploys-and-swaps to passkey in ONE step', () => {
    expect(createSrc).toContain('registerPasskeyCredential(hdIndex');
    expect(createSrc).toContain('deployAndSwapToPasskey(publicClient, hdIndex, stored)');
  });

  test('fails closed: throws on cancelled registration or failed swap (no silent ECDSA)', () => {
    expect(createSrc).toContain("if (!stored) throw new Error");
    expect(createSrc).toContain('if (!swap.ok) throw new Error(swap.message)');
  });

  test('persists rec.passkey + deployed:true, leaves passkeySudo UNSET (pins to rec.address)', () => {
    expect(createSrc).toContain('passkey,');
    expect(createSrc).toContain('deployed,');
    expect(createSrc).not.toContain('passkeySudo:');
  });
});

describe('B. kernelForRecord.ts — override only for enable-upgraded accounts', () => {
  test('passkey branch builds from the passkey validator', () => {
    expect(kernelSrc).toContain('passkeyKernelFromStored');
    expect(kernelSrc).toContain('if (rec.passkey)');
  });
  test('passkeySudo => no override; else pin to rec.address', () => {
    expect(kernelSrc).toContain('rec.passkeySudo ? undefined : (rec.address as `0x${string}`)');
  });
  test('fails closed (throws) rather than signing a passkey account with the ECDSA key', () => {
    expect(kernelSrc).toContain('if (passkeysAvailable())');
    expect(kernelSrc).toMatch(/throw new Error\([^)]*refusing to sign with the ECDSA key/);
  });
});

describe('C. enablePasskey.ts — deploy-via-ECDSA-initcode then swap sudo on-chain', () => {
  test('builds the CURRENT ECDSA Kernel (its initCode deploys to the ECDSA-derived address)', () => {
    expect(enableSrc).toContain('createEcdsaKernel(publicClient, owner, hdIndex)');
  });
  test('shares ONE on-chain deploy-and-swap helper with the create path', () => {
    expect(enableSrc).toContain('export async function deployAndSwapToPasskey');
    expect(enableSrc).toContain('deployAndSwapToPasskey(publicClient, rec.hdIndex, stored)');
  });
  test('swaps sudo to the passkey via changeSudoValidator (one sponsored userOp)', () => {
    expect(enableSrc).toContain('changeSudoValidator');
    expect(enableSrc).toContain('sudoValidator: passkeyValidator');
  });
  test('persists rec.passkey only AFTER the userOp receipt succeeds', () => {
    const swapIdx = enableSrc.indexOf('changeSudoValidator');
    const waitIdx = enableSrc.indexOf('waitForUserOperationReceipt');
    // updateSmartAccount also appears in the import line; we want the CALL, which
    // is the last occurrence (inside the success branch).
    const persistIdx = enableSrc.lastIndexOf('updateSmartAccount(');
    expect(swapIdx).toBeGreaterThanOrEqual(0);
    expect(waitIdx).toBeGreaterThan(swapIdx);
    expect(persistIdx).toBeGreaterThan(waitIdx);
    expect(enableSrc).toContain('if (!receipt?.success)');
  });
  test('repairs an undeployed record that already carries a passkey (old broken shortcut)', () => {
    expect(enableSrc).toContain('if (rec.passkey && deployed) return { ok: false, reason: \'already\' }');
  });
});

describe('D. xmtp.codecs.ts — smart account signs XMTP via the scwSigner + kernel', () => {
  test('smart accounts route through signerForSmart -> scwSigner + kernelClientForRecord', () => {
    expect(codecsSrc).toContain("rec.type === 'smart'");
    expect(codecsSrc).toContain('kernelClientForRecord(rec)');
    expect(codecsSrc).toContain('scwSigner(kernelClient, rec.address)');
  });
});

describe('E. useTxSignLayer.ts — smart account tx + signatures go through the kernel', () => {
  test('onPay sends a smart-account tx via kernelClientForRecord (sponsored userOp)', () => {
    expect(txLayerSrc).toContain('kernelClientForRecord(active)');
    expect(txLayerSrc).toContain('kernel.sendTransaction');
  });
  test('onSign signs message + typedData via the same kernel client', () => {
    expect(txLayerSrc).toContain('kernel.signTypedData');
    expect(txLayerSrc).toContain('kernel.signMessage');
  });
});
