/** @file Kernel smart-account construction (mnemonic-derived ECDSA owner or device passkey as the `sudo` validator) over one deterministic per-HD-index, counterfactual address space. */
import '../cryptoShim';
import type { PublicClient } from 'viem';
import type { HDAccount } from 'viem/accounts';
import { createKernelAccount, type CreateKernelAccountReturnType, type KernelValidator } from '@zerodev/sdk';
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import { ENTRY_POINT, KERNEL_VERSION } from './config';
import { passkeysAvailable } from './native';

/** Build JUST the ECDSA KernelValidator from the mnemonic-derived owner (no Kernel account); shared by createEcdsaKernel and the remove-passkey flow, which promotes this validator back to sudo on-chain to restore ECDSA root signing. */
export async function ecdsaValidatorForOwner(
  publicClient: PublicClient,
  owner: HDAccount,
): Promise<Awaited<ReturnType<typeof signerToEcdsaValidator>>> {
  return signerToEcdsaValidator(publicClient, {
    signer: owner,
    entryPoint: ENTRY_POINT,
    kernelVersion: KERNEL_VERSION,
  });
}

/** Build a counterfactual Kernel owned by an ECDSA `sudo` validator derived from the app mnemonic at `hdIndex`. No tx is sent; `.address` is the identity. */
export async function createEcdsaKernel(
  publicClient: PublicClient,
  owner: HDAccount,
  hdIndex: number,
): Promise<CreateKernelAccountReturnType> {
  const ecdsaValidator = await ecdsaValidatorForOwner(publicClient, owner);
  return createKernelAccount(publicClient, {
    plugins: { sudo: ecdsaValidator },
    entryPoint: ENTRY_POINT,
    kernelVersion: KERNEL_VERSION,
    index: BigInt(hdIndex),
  });
}

/** Narrowly-typed boundaries for the lazily-required native/SDK modules: shapes describe only the members used, and each require() result is typeof/`in`-guarded before use, failing closed on an unexpected shape. */

/** The live WebAuthn key handed to toPasskeyValidator. */
interface WebAuthnKey {
  pubX: bigint;
  pubY: bigint;
  authenticatorId: string;
  authenticatorIdHash: `0x${string}`;
  rpID: string;
  signMessageCallback: unknown;
}
/** The credential shape parsed back out of a WebAuthn create() result. */
interface ParsedPasskeyCred {
  pubX: bigint;
  pubY: bigint;
  authenticatorId: string;
  authenticatorIdHash: `0x${string}`;
}

/** Members of `@zerodev/react-native-passkeys-utils` we use. */
interface PasskeysUtilsModule {
  signMessageWithReactNativePasskeys: unknown;
  parsePasskeyCred: (cred: unknown, rpId: string) => ParsedPasskeyCred;
}

/** Members of `@zerodev/passkey-validator` we use. */
interface PasskeyValidatorModule {
  toPasskeyValidator: (publicClient: PublicClient, args: {
    webAuthnKey: WebAuthnKey;
    entryPoint: typeof ENTRY_POINT;
    kernelVersion: typeof KERNEL_VERSION;
    validatorContractVersion: string;
  }) => Promise<KernelValidator>;
  PasskeyValidatorContractVersion: Record<string, string>;
}

/** Members of `react-native-passkeys` we use. */
interface PasskeysNativeModule {
  create: (request: unknown) => Promise<unknown>;
  get: (request: unknown) => Promise<unknown>;
}

/** True for any non-null object — the base guard before `in` member probes. */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Narrow the passkeys-utils require() result; throws if the shape is wrong. */
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

/** Narrow the passkey-validator require() result; throws if the shape is wrong. */
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

/** Narrow the react-native-passkeys require() result; throws if the shape is wrong. */
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

/** The public WebAuthn key material persisted on an account record so the passkey validator can be REBUILT on later launches without re-registering. Mirrors AccountRecord.passkey — pubX/pubY are hex strings (bigint isn't JSON-safe). */
export interface StoredPasskey {
  pubX: string;
  pubY: string;
  authenticatorId: string;
  authenticatorIdHash: string;
  rpID: string;
}

/** Resolve the passkey WebAuthnValidator contract version by VALUE "0.0.3" (avoiding the enum-name typo trap): only the PATCHED 0.0.3 validator is paymaster-sponsorable, and since the version is part of the CREATE2 salt we don't auto-migrate existing 0.0.2 accounts. */
function passkeyContractVersion(
  PasskeyValidatorContractVersion: Record<string, string>,
): string {
  /** Match by the on-chain string VALUE; "0.0.3" is the PATCHED validator the ZeroDev paymaster sponsors (0.0.2 is unpatched and 403s on sponsored deploy). */
  const byValue = Object.values(PasskeyValidatorContractVersion).find((v) => v === '0.0.3');
  if (!byValue) throw new Error('Passkey validator contract version 0.0.3 (V0_0_3_PATCHED) not found in installed SDK');
  return byValue;
}

/** Reconstruct the live `WebAuthnKey` (with the on-device signing callback) from a StoredPasskey. PRIVATE — both the create path (after registration) and the rebuild path go through toPasskeyValidator with one of these. */
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
    /** The on-device WebAuthn assertion: the passkey prompt fires for every sign (userOp hash / message / typed data as the challenge); the mnemonic is never touched on this path. */
    signMessageCallback: signMessageWithReactNativePasskeys,
  };
}

/** Build a Kernel whose sole active validator is the passkey (sudo=passkey, NO regular): since the plugin manager picks `regular || sudo`, omitting regular makes the passkey sign everything and keeps the ECDSA owner recovery-only; lazy requires keep this bundling without the passkey deps. */
async function buildPasskeyKernel(
  publicClient: PublicClient,
  _owner: HDAccount,
  hdIndex: number,
  stored: StoredPasskey,
  /** For an existing account (enable-passkey), pin the Kernel to its known address so swapping sudo to the passkey doesn't change identity; omitted on fresh create, where the passkey is the sudo the address derives from. */
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
    /** sudo = passkey, NO regular: the passkey is the sole ACTIVE signer (see above). */
    plugins: { sudo: passkeyValidator },
    entryPoint: ENTRY_POINT,
    kernelVersion: KERNEL_VERSION,
    ...(addressOverride ? { address: addressOverride } : { index: BigInt(hdIndex) }),
  });
}

/** Build JUST the passkey KernelValidator from stored material (no Kernel account) for the enable-passkey flow's changeSudoValidator swap; null when the native module is absent, lazy require keeps this bundling without the passkey deps. */
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

/** REGISTER a new passkey credential for an existing account without building a Kernel (enable-passkey flow): runs the on-device WebAuthn create() and returns the StoredPasskey to persist; null when the native module is absent. */
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

/** REBUILD a passkey Kernel for an existing record from its StoredPasskey (no re-registration; the public key is reused and only the on-device assertion runs at sign time); null when the binary lacks the native module so the caller falls back to the ECDSA owner. */
export async function passkeyKernelFromStored(
  publicClient: PublicClient,
  owner: HDAccount,
  hdIndex: number,
  stored: StoredPasskey,
  /** The account's known address, required for passkeys added after creation (address derived from the ECDSA sudo) so the rebuilt passkey-sudo Kernel keeps the same identity; harmless on fresh passkey accounts. */
  addressOverride?: `0x${string}`,
): Promise<CreateKernelAccountReturnType | null> {
  if (!passkeysAvailable()) return null;
  try {
    return await buildPasskeyKernel(publicClient, owner, hdIndex, stored, addressOverride);
  } catch (e) {
    /** Native module present but reconstruction failed: a real bug, not an old binary — surface it in dev so it can't masquerade as "native absent"; caller still fails closed. */
    if (__DEV__) console.warn('[zerodev] passkey kernel rebuild failed:', e);
    return null;
  }
}

/** REVEAL-GATE passkey assertion: an on-device WebAuthn get() over a fresh challenge scoped to this credential with userVerification required, whose mere success gates secret reveal — true=pass, false=cancel/fail (don't reveal), null=no native module (caller falls back to the device-auth sentinel). */
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
    /** A null result means no credential was returned (failed gate); a cancel/error throws and is caught below. */
    return !!assertion;
  } catch {
    return false;
  }
}

/** base64url (no padding) — for the WebAuthn challenge + user id. */
function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  /** global btoa is provided by the RN/Hermes runtime + jsPolyfills. */
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
