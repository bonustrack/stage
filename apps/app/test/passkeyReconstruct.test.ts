/** PASSKEY RECONSTRUCTION ROUND-TRIP (the "passkey validator is not available" bug).
 *
 *  Regression: account.ts referenced `PasskeyValidatorContractVersion.V0_0_2`,
 *  which is NOT a member of the installed @zerodev/passkey-validator enum (members
 *  are V0_0_1_UNPATCHED / V0_0_2_UNPATCHED / V0_0_3_PATCHED). Because the SDK is
 *  required lazily (untyped), tsc never flagged it; at runtime the value was
 *  `undefined`, so toPasskeyValidator -> getValidatorAddress could not resolve a
 *  validator address and THREW. The rebuild's catch swallowed it and the caller
 *  reported "passkey validator unavailable" for a perfectly reconstructable
 *  passkey.
 *
 *  These tests run in CI (pure JS — no native module, no on-device WebAuthn):
 *    1. The contract version resolves to a REAL enum value (catches the typo).
 *    2. toPasskeyValidator reconstructs a validator from realistic STORED pubkey
 *       material (the rebuild path) without throwing, with a resolvable on-chain
 *       validator address (the exact step that used to throw). The on-device
 *       signMessageCallback is stubbed; building the validator object is pure JS. */

import { describe, expect, test } from 'bun:test';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import {
  PasskeyValidatorContractVersion,
  toPasskeyValidator,
} from '@zerodev/passkey-validator';
import { getEntryPoint, KERNEL_V3_1 } from '@zerodev/sdk/constants';

const ENTRY_POINT = getEntryPoint('0.7');

/** A realistic StoredPasskey the way create/enable persists it: pubX/pubY are hex
 *  strings (0x + bigint), authenticatorIdHash is a 0x32-byte keccak, rpID a host. */
const STORED = {
  pubX: '0x' + 'a3'.repeat(32),
  pubY: '0x' + 'b7'.repeat(32),
  authenticatorId: 'AQIDBAUGBwgJCgsMDQ4PEA',
  authenticatorIdHash: ('0x' + 'cd'.repeat(32)) as `0x${string}`,
  rpID: 'metro.box',
};

describe('passkey contract version resolves to a real enum member', () => {
  test('the value "0.0.2" exists in the installed enum', () => {
    // The bug: `.V0_0_2` is undefined. Resolve by value instead.
    const values = Object.values(PasskeyValidatorContractVersion);
    expect(values).toContain('0.0.2');
    // And the literal member that used to be referenced does NOT exist.
    expect((PasskeyValidatorContractVersion as Record<string, string>).V0_0_2).toBeUndefined();
  });
});

describe('reconstruct a passkey validator from stored material (rebuild path)', () => {
  test('toPasskeyValidator builds a validator with a resolvable address (no throw)', async () => {
    // Offline public client: toPasskeyValidator only calls getChainId, which viem
    // can serve from the chain config without a live RPC round-trip in build.
    const publicClient = createPublicClient({ chain: base, transport: http() });
    const webAuthnKey = {
      pubX: BigInt(STORED.pubX),
      pubY: BigInt(STORED.pubY),
      authenticatorId: STORED.authenticatorId,
      authenticatorIdHash: STORED.authenticatorIdHash,
      rpID: STORED.rpID,
      // On-device assertion is stubbed; not invoked during construction.
      signMessageCallback: () => Promise.resolve('0x' as `0x${string}`),
    };
    const validator = await toPasskeyValidator(publicClient, {
      webAuthnKey,
      entryPoint: ENTRY_POINT,
      kernelVersion: KERNEL_V3_1,
      validatorContractVersion: PasskeyValidatorContractVersion.V0_0_2_UNPATCHED,
    });
    // A real on-chain WebAuthnValidator address was resolved (the step that threw).
    expect(validator.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(validator.source).toBe('WebAuthnValidator');
    // getEnableData encodes the stored pubkey -> proves the bigint material is usable.
    const enableData = await validator.getEnableData();
    expect(enableData).toMatch(/^0x[0-9a-fA-F]+$/);
  });
});
