import '../cryptoShim';
import type { PublicClient } from 'viem';
import type { HDAccount } from 'viem/accounts';
import { createKernelAccount, type CreateKernelAccountReturnType, type KernelValidator } from '@zerodev/sdk';
import { ENTRY_POINT, KERNEL_VERSION } from './config';
import { passkeysAvailable } from './native';

export { createEcdsaKernel, ecdsaValidatorForOwner } from '@stage-labs/client/zerodev/account';


interface WebAuthnKey {
  pubX: bigint;
  pubY: bigint;
  authenticatorId: string;
  authenticatorIdHash: `0x${string}`;
  rpID: string;
  signMessageCallback: unknown;
}
interface ParsedPasskeyCred {
  pubX: bigint;
  pubY: bigint;
  authenticatorId: string;
  authenticatorIdHash: `0x${string}`;
}

interface PasskeysUtilsModule {
  signMessageWithReactNativePasskeys: unknown;
  parsePasskeyCred: (cred: unknown, rpId: string) => ParsedPasskeyCred;
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

interface PasskeysNativeModule {
  create: (request: unknown) => Promise<unknown>;
  get: (request: unknown) => Promise<unknown>;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asPasskeysUtils(mod: unknown): PasskeysUtilsModule {
  if (
    isObject(mod) &&
    'parsePasskeyCred' in mod &&
    typeof mod.parsePasskeyCred === 'function' &&
    'signMessageWithReactNativePasskeys' in mod
  ) {
    return {
      signMessageWithReactNativePasskeys: mod.signMessageWithReactNativePasskeys,
      parsePasskeyCred: mod.parsePasskeyCred as PasskeysUtilsModule['parsePasskeyCred'],
    };
  }
  throw new Error('Unexpected @zerodev/react-native-passkeys-utils shape');
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

function asPasskeysNative(mod: unknown): PasskeysNativeModule {
  if (
    isObject(mod) &&
    'create' in mod &&
    typeof mod.create === 'function' &&
    'get' in mod &&
    typeof mod.get === 'function'
  ) {
    return {
      create: mod.create as PasskeysNativeModule['create'],
      get: mod.get as PasskeysNativeModule['get'],
    };
  }
  throw new Error('Unexpected react-native-passkeys shape');
}

export interface StoredPasskey {
  pubX: string;
  pubY: string;
  authenticatorId: string;
  authenticatorIdHash: string;
  rpID: string;
}

function passkeyContractVersion(
  PasskeyValidatorContractVersion: Record<string, string>,
): string {
  const byValue = Object.values(PasskeyValidatorContractVersion).find((v) => v === '0.0.3');
  if (!byValue) throw new Error('Passkey validator contract version 0.0.3 (V0_0_3_PATCHED) not found in installed SDK');
  return byValue;
}

function liveWebAuthnKey(stored: StoredPasskey): WebAuthnKey {
  const { signMessageWithReactNativePasskeys } = asPasskeysUtils(
    require('@zerodev/react-native-passkeys-utils'),
  );
  return {
    pubX: BigInt(stored.pubX),
    pubY: BigInt(stored.pubY),
    authenticatorId: stored.authenticatorId,
    authenticatorIdHash: stored.authenticatorIdHash as `0x${string}`,
    rpID: stored.rpID,
    signMessageCallback: signMessageWithReactNativePasskeys,
  };
}

async function buildPasskeyKernel(
  publicClient: PublicClient,
  _owner: HDAccount,
  hdIndex: number,
  stored: StoredPasskey,
  addressOverride?: `0x${string}`,
): Promise<CreateKernelAccountReturnType> {
  const { toPasskeyValidator, PasskeyValidatorContractVersion } = asPasskeyValidator(
    require('@zerodev/passkey-validator'),
  );
  const passkeyValidator = await toPasskeyValidator(publicClient, {
    webAuthnKey: liveWebAuthnKey(stored),
    entryPoint: ENTRY_POINT,
    kernelVersion: KERNEL_VERSION,
    validatorContractVersion: passkeyContractVersion(PasskeyValidatorContractVersion),
  });
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
    const { toPasskeyValidator, PasskeyValidatorContractVersion } = asPasskeyValidator(
      require('@zerodev/passkey-validator'),
    );
    return await toPasskeyValidator(publicClient, {
      webAuthnKey: liveWebAuthnKey(stored),
      entryPoint: ENTRY_POINT,
      kernelVersion: KERNEL_VERSION,
      validatorContractVersion: passkeyContractVersion(PasskeyValidatorContractVersion),
    });
  } catch {
    return null;
  }
}

export async function registerPasskeyCredential(
  hdIndex: number,
  opts: { rpId: string; userName: string; userDisplayName?: string },
): Promise<StoredPasskey | null> {
  if (!passkeysAvailable()) return null;
  try {
    const passkey = asPasskeysNative(require('react-native-passkeys'));
    const { parsePasskeyCred } = asPasskeysUtils(require('@zerodev/react-native-passkeys-utils'));
    const challengeBytes = new Uint8Array(32);
    crypto.getRandomValues(challengeBytes);
    const challenge = bytesToBase64Url(challengeBytes);
    const cred = await passkey.create({
      challenge,
      pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
      rp: { id: opts.rpId, name: 'Stage' },
      user: {
        id: bytesToBase64Url(new TextEncoder().encode(`${opts.userName}:${hdIndex}`)),
        name: opts.userName,
        displayName: opts.userDisplayName ?? opts.userName,
      },
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    });
    const parsed = parsePasskeyCred(cred, opts.rpId);
    return {
      pubX: `0x${parsed.pubX.toString(16)}`,
      pubY: `0x${parsed.pubY.toString(16)}`,
      authenticatorId: parsed.authenticatorId,
      authenticatorIdHash: parsed.authenticatorIdHash,
      rpID: opts.rpId,
    };
  } catch {
    return null;
  }
}

export async function passkeyKernelFromStored(
  publicClient: PublicClient,
  owner: HDAccount,
  hdIndex: number,
  stored: StoredPasskey,
  addressOverride?: `0x${string}`,
): Promise<CreateKernelAccountReturnType | null> {
  if (!passkeysAvailable()) return null;
  try {
    return await buildPasskeyKernel(publicClient, owner, hdIndex, stored, addressOverride);
  } catch (e) {
    if (__DEV__) console.warn('[zerodev] passkey kernel rebuild failed:', e);
    return null;
  }
}

export async function assertPasskeyPresence(stored: StoredPasskey): Promise<boolean | null> {
  if (!passkeysAvailable()) return null;
  try {
    const passkey = asPasskeysNative(require('react-native-passkeys'));
    const challengeBytes = new Uint8Array(32);
    crypto.getRandomValues(challengeBytes);
    const assertion = await passkey.get({
      challenge: bytesToBase64Url(challengeBytes),
      rpId: stored.rpID,
      allowCredentials: [{ id: stored.authenticatorId, type: 'public-key' }],
      userVerification: 'required',
    });
    return !!assertion;
  } catch {
    return false;
  }
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
