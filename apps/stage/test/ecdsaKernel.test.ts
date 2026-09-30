import { describe, expect, test } from 'bun:test';
import { recoverMessageAddress, recoverTypedDataAddress } from 'viem';
import { getUserOperationHash } from 'viem/account-abstraction';
import { mnemonicToAccount } from 'viem/accounts';
import { createEcdsaKernel, ecdsaValidatorForOwner, ENTRY_POINT } from '@stage-labs/client/zerodev/account';
import { recordedBaseClient as publicClient } from './recordedBaseRpc';

const PHRASE = 'test test test test test test test test test test test junk';
const EXISTING = '0x00000000000000000000000000000000DeaDBeef';
const ownerFor = (index: number) => mnemonicToAccount(PHRASE, { addressIndex: index });

const TYPED_DATA = {
  domain: { name: 'Stage wallet test', version: '1', chainId: 8453 },
  types: { Message: [{ name: 'text', type: 'string' }] },
  primaryType: 'Message',
  message: { text: 'Confirm wallet ownership' },
} as const;

describe('ECDSA Kernel wallet identity', () => {
  test('keeps the recorded normal wallet addresses and HD indices', async () => {
    const first = await createEcdsaKernel(publicClient, ownerFor(0), 0);
    const fourth = await createEcdsaKernel(publicClient, ownerFor(3), 3);
    expect(first.address.toLowerCase()).toBe('0xb3729f7e1ab0b4a50e7de5599ecc321b8775d30d');
    expect(fourth.address.toLowerCase()).toBe('0xcc6dc4fe2262e6af3cb19fba2d038e2c540ae08e');
    expect((await createEcdsaKernel(publicClient, ownerFor(0), 0)).address).toBe(first.address);
  });

  test('rebuilds an existing address without changing its ECDSA owner or deployment index', async () => {
    const first = await createEcdsaKernel(publicClient, ownerFor(0), 0, EXISTING);
    const fourth = await createEcdsaKernel(publicClient, ownerFor(3), 3, EXISTING);
    expect(first.address).toBe(EXISTING);
    const a = await first.getFactoryArgs();
    const b = await fourth.getFactoryArgs();
    expect(a.factory).toBe(b.factory);
    expect(a.factory).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(a.factoryData?.toLowerCase()).toContain(ownerFor(0).address.slice(2).toLowerCase());
    expect(b.factoryData?.toLowerCase()).toContain(ownerFor(3).address.slice(2).toLowerCase());
    expect(a.factoryData).not.toBe(b.factoryData);
  });
});

describe('ECDSA owner signing', () => {
  test('signs messages and typed data with the same recovery owner', async () => {
    const owner = ownerFor(3);
    const validator = await ecdsaValidatorForOwner(publicClient, owner);
    expect(validator.source).toBe('ECDSAValidator');
    expect(await validator.getEnableData()).toBe(owner.address);
    const message = 'Stage recovery owner';
    const signature = await validator.signMessage({ message });
    expect(await recoverMessageAddress({ message, signature })).toBe(owner.address);
    const typedSignature = await validator.signTypedData(TYPED_DATA);
    expect(await recoverTypedDataAddress({ ...TYPED_DATA, signature: typedSignature })).toBe(owner.address);
  });

  test('signs a Base user operation with the recovery owner', async () => {
    const owner = ownerFor(0);
    const validator = await ecdsaValidatorForOwner(publicClient, owner);
    const userOperation = {
      sender: EXISTING,
      nonce: 0n,
      callData: '0x',
      callGasLimit: 100_000n,
      verificationGasLimit: 100_000n,
      preVerificationGas: 21_000n,
      maxFeePerGas: 1n,
      maxPriorityFeePerGas: 1n,
      signature: '0x',
    } as const;
    const hash = getUserOperationHash({
      userOperation,
      entryPointAddress: ENTRY_POINT.address,
      entryPointVersion: '0.7',
      chainId: 8453,
    });
    const signature = await validator.signUserOperation(userOperation);
    expect(await recoverMessageAddress({ message: { raw: hash }, signature })).toBe(owner.address);
  });
});
