import '../cryptoShim';
import type { PublicClient } from 'viem';
import { createKernelAccount, type CreateKernelAccountReturnType, type KernelValidator } from '@zerodev/sdk';
import { ENTRY_POINT, KERNEL_VERSION } from '@stage-labs/client/zerodev/account';
import { passkeysAvailable, passkeySignMessageCallback } from './passkeys';
import type { StoredPasskey } from './passkeys.model';

export { createEcdsaKernel, ecdsaValidatorForOwner } from '@stage-labs/client/zerodev/account';


interface WebAuthnKey {
  pubX: bigint;
  pubY: bigint;
  authenticatorId: string;
  authenticatorIdHash: `0x${string}`;
  rpID: string;
  signMessageCallback: unknown;
}

interface PasskeyValidatorModule {
  toPasskeyValidator: (publicClient: PublicClient, args: {
    webAuthnKey: WebAuthnKey;
    entryPoint: typeof ENTRY_POINT;
    kernelVersion: typeof KERNEL_VERSION;
    validatorContractVersion: string;
  }) => Promise<KernelValidator>;
  PasskeyValidatorContractVersion: Record<string, string>;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asPasskeyValidator(mod: unknown): PasskeyValidatorModule {
  if (
    isObject(mod) &&
    'toPasskeyValidator' in mod &&
    typeof mod.toPasskeyValidator === 'function' &&
    'PasskeyValidatorContractVersion' in mod &&
    isObject(mod.PasskeyValidatorContractVersion)
  ) {
    return {
      toPasskeyValidator: mod.toPasskeyValidator as PasskeyValidatorModule['toPasskeyValidator'],
      PasskeyValidatorContractVersion:
        mod.PasskeyValidatorContractVersion as Record<string, string>,
    };
  }
  throw new Error('Unexpected @zerodev/passkey-validator shape');
}

function passkeyContractVersion(
  PasskeyValidatorContractVersion: Record<string, string>,
): string {
  const byValue = Object.values(PasskeyValidatorContractVersion).find((v) => v === '0.0.3');
  if (!byValue) throw new Error('Passkey validator contract version 0.0.3 (V0_0_3_PATCHED) not found in installed SDK');
  return byValue;
}

function liveWebAuthnKey(stored: StoredPasskey): WebAuthnKey {
  return {
    pubX: BigInt(stored.pubX),
    pubY: BigInt(stored.pubY),
    authenticatorId: stored.authenticatorId,
    authenticatorIdHash: stored.authenticatorIdHash as `0x${string}`,
    rpID: stored.rpID,
    signMessageCallback: passkeySignMessageCallback(),
  };
}

function buildPasskeyValidator(publicClient: PublicClient, stored: StoredPasskey): Promise<KernelValidator> {
  const { toPasskeyValidator, PasskeyValidatorContractVersion } = asPasskeyValidator(
    require('@zerodev/passkey-validator'),
  );
  return toPasskeyValidator(publicClient, {
    webAuthnKey: liveWebAuthnKey(stored),
    entryPoint: ENTRY_POINT,
    kernelVersion: KERNEL_VERSION,
    validatorContractVersion: passkeyContractVersion(PasskeyValidatorContractVersion),
  });
}

async function buildPasskeyKernel(
  publicClient: PublicClient,
  hdIndex: number,
  stored: StoredPasskey,
  addressOverride?: `0x${string}`,
): Promise<CreateKernelAccountReturnType> {
  const passkeyValidator = await buildPasskeyValidator(publicClient, stored);
  return createKernelAccount(publicClient, {
    plugins: { sudo: passkeyValidator },
    entryPoint: ENTRY_POINT,
    kernelVersion: KERNEL_VERSION,
    ...(addressOverride ? { address: addressOverride } : { index: BigInt(hdIndex) }),
  });
}

export async function passkeyValidatorFromStored(
  publicClient: PublicClient,
  stored: StoredPasskey,
): Promise<unknown> {
  if (!passkeysAvailable()) return null;
  try {
    return await buildPasskeyValidator(publicClient, stored);
  } catch {
    return null;
  }
}

export type PasskeyKernelResult = { account: CreateKernelAccountReturnType } | { error: string };

export async function passkeyKernelResult(
  publicClient: PublicClient,
  hdIndex: number,
  stored: StoredPasskey,
  addressOverride?: `0x${string}`,
): Promise<PasskeyKernelResult> {
  if (!passkeysAvailable()) return { error: 'passkeys are not available on this device' };
  try {
    return { account: await buildPasskeyKernel(publicClient, hdIndex, stored, addressOverride) };
  } catch (e) {
    return { error: e instanceof Error ? e.message.split('\n')[0] ?? 'unknown error' : String(e) };
  }
}
