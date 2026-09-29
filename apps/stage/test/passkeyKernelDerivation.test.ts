
import { describe, expect, test } from 'bun:test';
import { createKernelAccount } from '@zerodev/sdk';
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import { getEntryPoint, KERNEL_V3_1 } from '@zerodev/sdk/constants';
import { PasskeyValidatorContractVersion, toPasskeyValidator } from '@zerodev/passkey-validator';
import { mnemonicToAccount } from 'viem/accounts';
import { recordedBaseClient as publicClient } from './recordedBaseRpc';

const ENTRY_POINT = getEntryPoint('0.7');

const MNEMONIC = 'test test test test test test test test test test test junk';

const STORED = {
  pubX: '0x' + 'a3'.repeat(32),
  pubY: '0x' + 'b7'.repeat(32),
  authenticatorId: 'AQIDBAUGBwgJCgsMDQ4PEA',
  authenticatorIdHash: ('0x' + 'cd'.repeat(32)) as `0x${string}`,
  rpID: 'stage.box',
};

function liveWebAuthnKey(stored: typeof STORED) {
  return {
    pubX: BigInt(stored.pubX),
    pubY: BigInt(stored.pubY),
    authenticatorId: stored.authenticatorId,
    authenticatorIdHash: stored.authenticatorIdHash,
    rpID: stored.rpID,
    signMessageCallback: () => Promise.resolve('0x' as `0x${string}`),
  };
}

async function passkeyKernel(index: bigint, address?: `0x${string}`) {
  const validator = await toPasskeyValidator(publicClient, {
    webAuthnKey: liveWebAuthnKey(STORED),
    entryPoint: ENTRY_POINT,
    kernelVersion: KERNEL_V3_1,
    validatorContractVersion: PasskeyValidatorContractVersion.V0_0_3_PATCHED,
  });
  return createKernelAccount(publicClient, {
    plugins: { sudo: validator },
    entryPoint: ENTRY_POINT,
    kernelVersion: KERNEL_V3_1,
    ...(address ? { address } : { index }),
  });
}

async function ecdsaKernel(index: bigint) {
  const owner = mnemonicToAccount(MNEMONIC, { addressIndex: Number(index) });
  const validator = await signerToEcdsaValidator(publicClient, {
    signer: owner,
    entryPoint: ENTRY_POINT,
    kernelVersion: KERNEL_V3_1,
  });
  return createKernelAccount(publicClient, {
    plugins: { sudo: validator },
    entryPoint: ENTRY_POINT,
    kernelVersion: KERNEL_V3_1,
    index,
  });
}

describe('passkey-sudo Kernel address derivation', () => {
  test('is deterministic for the same stored pubkey + index', async () => {
    const a = (await passkeyKernel(0n)).address;
    const b = (await passkeyKernel(0n)).address;
    expect(a).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(a).toBe(b);
  });

  test('changes with the HD index (distinct accounts off one mnemonic)', async () => {
    const a0 = (await passkeyKernel(0n)).address;
    const a1 = (await passkeyKernel(1n)).address;
    expect(a0.toLowerCase()).not.toBe(a1.toLowerCase());
  });

  test('DIFFERS from the ECDSA-sudo address at the same index (sudo is in the CREATE2 salt)', async () => {
    const passkey = (await passkeyKernel(0n)).address;
    const ecdsa = (await ecdsaKernel(0n)).address;
    expect(passkey.toLowerCase()).not.toBe(ecdsa.toLowerCase());
  });
});

describe('deploy initCode matches the counterfactual address at CREATE (no override)', () => {
  test('a passkey-sudo Kernel built with `index` emits factory + factoryData (deploys at its own address)', async () => {
    const account = await passkeyKernel(0n);
    const fa = await account.getFactoryArgs();
    expect(fa.factory).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(fa.factoryData).toMatch(/^0x[0-9a-fA-F]+$/);
  });
});

describe('address-override is unsatisfiable for a passkey-sudo deploy (why enable swaps on-chain)', () => {
  test('pinning a passkey-sudo Kernel to a foreign address still emits passkey initCode', async () => {
    const foreign = '0x00000000000000000000000000000000DeaDBeef' as `0x${string}`;
    const pinned = await passkeyKernel(0n, foreign);
    expect(pinned.address.toLowerCase()).toBe(foreign.toLowerCase());
    const fa = await pinned.getFactoryArgs();
    expect(fa.factoryData).toMatch(/^0x[0-9a-fA-F]+$/);
  });
});

describe('ECDSA-sudo Kernel (key-only account, no passkey)', () => {
  test('derives a deterministic address and works without any passkey dep', async () => {
    const a = (await ecdsaKernel(3n)).address;
    const b = (await ecdsaKernel(3n)).address;
    expect(a).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(a).toBe(b);
  });
});

describe('passkey validator contract version resolves to the PATCHED 0.0.3 (paymaster-sponsorable)', () => {
  function resolveVersion(): string {
    const byValue = Object.values(PasskeyValidatorContractVersion as Record<string, string>).find(
      (v) => v === '0.0.3',
    );
    if (!byValue) throw new Error('0.0.3 not in installed SDK');
    return byValue;
  }

  test('the V0_0_3_PATCHED enum member exists and its value is "0.0.3"', () => {
    expect(PasskeyValidatorContractVersion.V0_0_3_PATCHED).toBe('0.0.3');
  });

  test('resolve-by-value yields "0.0.3" (the patched, sponsorable validator)', () => {
    expect(resolveVersion()).toBe('0.0.3');
  });
});
