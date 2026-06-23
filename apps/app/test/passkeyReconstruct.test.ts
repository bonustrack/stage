
import { describe, expect, test } from 'bun:test';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import {
  PasskeyValidatorContractVersion,
  toPasskeyValidator,
} from '@zerodev/passkey-validator';
import { getEntryPoint, KERNEL_V3_1 } from '@zerodev/sdk/constants';

const ENTRY_POINT = getEntryPoint('0.7');

const STORED = {
  pubX: '0x' + 'a3'.repeat(32),
  pubY: '0x' + 'b7'.repeat(32),
  authenticatorId: 'AQIDBAUGBwgJCgsMDQ4PEA',
  authenticatorIdHash: ('0x' + 'cd'.repeat(32)) as `0x${string}`,
  rpID: 'metro.box',
};

describe('passkey contract version resolves to a real enum member', () => {
  test('the value "0.0.2" exists in the installed enum', () => {
    const values = Object.values(PasskeyValidatorContractVersion);
    expect(values).toContain('0.0.2');
    expect((PasskeyValidatorContractVersion as Record<string, string>).V0_0_2).toBeUndefined();
  });
});

describe('reconstruct a passkey validator from stored material (rebuild path)', () => {
  test('toPasskeyValidator builds a validator with a resolvable address (no throw)', async () => {
    const publicClient = createPublicClient({ chain: base, transport: http() });
    const webAuthnKey = {
      pubX: BigInt(STORED.pubX),
      pubY: BigInt(STORED.pubY),
      authenticatorId: STORED.authenticatorId,
      authenticatorIdHash: STORED.authenticatorIdHash,
      rpID: STORED.rpID,
      signMessageCallback: () => Promise.resolve('0x' as `0x${string}`),
    };
    const validator = await toPasskeyValidator(publicClient, {
      webAuthnKey,
      entryPoint: ENTRY_POINT,
      kernelVersion: KERNEL_V3_1,
      validatorContractVersion: PasskeyValidatorContractVersion.V0_0_2_UNPATCHED,
    });
    expect(validator.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(validator.source).toBe('WebAuthnValidator');
    const enableData = await validator.getEnableData();
    expect(enableData).toMatch(/^0x[0-9a-fA-F]+$/);
  });
});
