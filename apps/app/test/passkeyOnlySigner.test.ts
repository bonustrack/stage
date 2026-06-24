
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';

const APP_ROOT = join(import.meta.dir, '..');
const KERNEL_FOR_RECORD = join(APP_ROOT, 'lib', 'zerodev', 'kernelForRecord.ts');
const ACCOUNT = join(APP_ROOT, 'lib', 'zerodev', 'account.ts');

const kernelSrc = readFileSync(KERNEL_FOR_RECORD, 'utf8');
const accountSrc = readFileSync(ACCOUNT, 'utf8');

function bodyOf(src: string, fn: string): string {
  const i = src.indexOf(`export async function ${fn}`);
  expect(i).toBeGreaterThanOrEqual(0);
  return src.slice(i);
}

describe('passkey-only signer (kernelForRecord chokepoint)', () => {
  const body = bodyOf(kernelSrc, 'kernelClientForRecord');

  test('passkey branch builds the Kernel from the passkey validator', () => {
    const passkeyCall = body.indexOf('passkeyKernelFromStored');
    expect(passkeyCall).toBeGreaterThanOrEqual(0);
    expect(body).toContain('if (rec.passkey)');
  });

  test('mnemonic is NOT read before the passkey kernel is built', () => {
    const passkeyBuild = body.indexOf('passkeyKernelFromStored');
    const firstOwnerRead = body.indexOf('smartOwnerSigner');
    expect(passkeyBuild).toBeGreaterThanOrEqual(0);
    expect(firstOwnerRead).toBeGreaterThan(passkeyBuild);
  });

  test('passkey account fails closed (throws) instead of signing with the key', () => {
    expect(body).toContain('if (passkeysAvailable())');
    expect(body).toMatch(/throw new Error\([^)]*refusing to sign with the ECDSA key/);
  });

  test('passkey kernel pins the address only for enable-upgraded accounts', () => {
    expect(body).toContain('rec.passkeySudo ? undefined : (rec.address as `0x${string}`)');
  });
});

describe('passkey validator is the sole active plugin (account.ts)', () => {
  test('buildPasskeyKernel uses sudo=passkey with NO regular validator', () => {
    const i = accountSrc.indexOf('async function buildPasskeyKernel');
    const j = accountSrc.indexOf('async function passkeyValidatorFromStored');
    const block = accountSrc
      .slice(i, j)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    expect(block).toContain('plugins: { sudo: passkeyValidator }');
    expect(block).not.toMatch(/regular\s*:/);
    expect(block).not.toContain('signerToEcdsaValidator');
  });
});
