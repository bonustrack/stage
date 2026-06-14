/** Kernel smart-account construction.
 *
 *  Two creation paths share one address space (deterministic per HD index):
 *    - ECDSA owner (always works, no native dep): the mnemonic-derived owner is
 *      the `sudo` validator. This is the canonical phrase-restore path (spec
 *      Screen 3 / Path A) and the path used until the passkey APK ships.
 *    - Passkey (user accounts, needs the new APK): the device passkey is `sudo`;
 *      built SERVERLESS (spec §z). Guarded behind passkeysAvailable() + lazy
 *      requires so a binary without `react-native-passkeys` / the @zerodev passkey
 *      JS packages neither crashes nor fails to bundle/typecheck.
 *
 *  The account is COUNTERFACTUAL — `account.address` is available immediately and
 *  is the wallet identity; the Kernel deploys lazily inside the first sponsored
 *  userOp (see ./client). `index: BigInt(hdIndex)` makes the address reproducible
 *  from the phrase + index alone. */

import '../cryptoShim';
import type { PublicClient } from 'viem';
import type { HDAccount } from 'viem/accounts';
import { createKernelAccount, type CreateKernelAccountReturnType } from '@zerodev/sdk';
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import { ENTRY_POINT, KERNEL_VERSION } from './config';
import { passkeysAvailable } from './native';

/** Build a counterfactual Kernel owned by an ECDSA `sudo` validator derived from
 *  the app mnemonic at `hdIndex`. No tx is sent; `.address` is the identity. */
export async function createEcdsaKernel(
  publicClient: PublicClient,
  owner: HDAccount,
  hdIndex: number,
): Promise<CreateKernelAccountReturnType> {
  const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
    signer: owner,
    entryPoint: ENTRY_POINT,
    kernelVersion: KERNEL_VERSION,
  });
  return createKernelAccount(publicClient, {
    plugins: { sudo: ecdsaValidator },
    entryPoint: ENTRY_POINT,
    kernelVersion: KERNEL_VERSION,
    index: BigInt(hdIndex),
  });
}

/** The public WebAuthn key material persisted on an account record so the passkey
 *  validator can be REBUILT on later launches without re-registering. Mirrors
 *  AccountRecord.passkey — pubX/pubY are hex strings (bigint isn't JSON-safe). */
export interface StoredPasskey {
  pubX: string;
  pubY: string;
  authenticatorId: string;
  authenticatorIdHash: string;
  rpID: string;
}

/** Result of the passkey CREATE path: the counterfactual Kernel (passkey `sudo`,
 *  ECDSA owner `regular`) plus the StoredPasskey to persist on the record. */
export interface PasskeyKernelResult {
  account: CreateKernelAccountReturnType;
  passkey: StoredPasskey;
}

/** Reconstruct the live `WebAuthnKey` (with the on-device signing callback) from a
 *  StoredPasskey. PRIVATE — both the create path (after registration) and the
 *  rebuild path go through toPasskeyValidator with one of these. */
function liveWebAuthnKey(stored: StoredPasskey) {
  const { signMessageWithReactNativePasskeys } = require('@zerodev/react-native-passkeys-utils');
  return {
    pubX: BigInt(stored.pubX),
    pubY: BigInt(stored.pubY),
    authenticatorId: stored.authenticatorId,
    authenticatorIdHash: stored.authenticatorIdHash as `0x${string}`,
    rpID: stored.rpID,
    // The WebAuthn assertion runs on-device — this is where the passkey prompt
    // is triggered for every sign (userOp hash / message / typed data as the
    // WebAuthn challenge). The mnemonic is never touched on this path.
    signMessageCallback: signMessageWithReactNativePasskeys,
  };
}

/** Build a Kernel whose `sudo` validator is the PASSKEY (from StoredPasskey) and
 *  whose `regular` backup is the mnemonic-derived ECDSA owner. Used by BOTH the
 *  create path (right after registration) and the rebuild path (later launches),
 *  so every signing client routes signing through the passkey when one is set.
 *  Lazy requires keep this file bundling/typechecking without the passkey deps. */
async function buildPasskeyKernel(
  publicClient: PublicClient,
  owner: HDAccount,
  hdIndex: number,
  stored: StoredPasskey,
): Promise<CreateKernelAccountReturnType> {
  const { toPasskeyValidator, PasskeyValidatorContractVersion } = require('@zerodev/passkey-validator');
  const passkeyValidator = await toPasskeyValidator(publicClient, {
    webAuthnKey: liveWebAuthnKey(stored),
    entryPoint: ENTRY_POINT,
    kernelVersion: KERNEL_VERSION,
    validatorContractVersion: PasskeyValidatorContractVersion.V0_0_2,
  });
  const ownerValidator = await signerToEcdsaValidator(publicClient, {
    signer: owner,
    entryPoint: ENTRY_POINT,
    kernelVersion: KERNEL_VERSION,
  });
  return createKernelAccount(publicClient, {
    plugins: { sudo: passkeyValidator, regular: ownerValidator },
    entryPoint: ENTRY_POINT,
    kernelVersion: KERNEL_VERSION,
    index: BigInt(hdIndex),
  });
}

/** REBUILD a passkey Kernel for an existing record from its StoredPasskey. Returns
 *  null when the running binary lacks the passkey native module (caller falls back
 *  to the ECDSA owner so an old binary still loads). No re-registration: the public
 *  key material is reused; only the on-device WebAuthn ASSERTION (the prompt) runs
 *  at sign time. */
export async function passkeyKernelFromStored(
  publicClient: PublicClient,
  owner: HDAccount,
  hdIndex: number,
  stored: StoredPasskey,
): Promise<CreateKernelAccountReturnType | null> {
  if (!passkeysAvailable()) return null;
  try {
    return await buildPasskeyKernel(publicClient, owner, hdIndex, stored);
  } catch {
    return null;
  }
}

/** Build a counterfactual Kernel with a device PASSKEY as `sudo` and the
 *  mnemonic-derived owner as the `regular` backup validator. Returns null when
 *  the running binary lacks the passkey native module (caller falls back to
 *  createEcdsaKernel + shows the "needs the new app build" state).
 *
 *  SERVERLESS construction (spec §z): the registration challenge is
 *  client-generated, the pubkey is parsed on-device from the create() response,
 *  signing uses the userOp hash as the WebAuthn challenge. NO passkey server.
 *
 *  Returns the account AND the StoredPasskey the caller must persist on the
 *  record so the validator can be rebuilt on later launches (createPasskeyKernel
 *  registers a NEW credential; the rebuild path is passkeyKernelFromStored).
 *
 *  All passkey deps are required LAZILY here so this file bundles/typechecks
 *  without `react-native-passkeys` / `@zerodev/passkey-validator` /
 *  `@zerodev/webauthn-key` / `@zerodev/react-native-passkeys-utils` present. */
export async function createPasskeyKernel(
  publicClient: PublicClient,
  owner: HDAccount,
  hdIndex: number,
  opts: { rpId: string; userName: string; userDisplayName?: string },
): Promise<PasskeyKernelResult | null> {
  if (!passkeysAvailable()) return null;
  try {
    const passkey = require('react-native-passkeys');
    const { parsePasskeyCred } = require('@zerodev/react-native-passkeys-utils');

    // Client-generated 32-byte random challenge (base64url) — see spec §z(b).
    const challengeBytes = new Uint8Array(32);
    crypto.getRandomValues(challengeBytes);
    const challenge = bytesToBase64Url(challengeBytes);

    const cred = await passkey.create({
      challenge,
      pubKeyCredParams: [{ alg: -7, type: 'public-key' }], // ES256 / P-256
      rp: { id: opts.rpId, name: 'Stage' },
      user: {
        id: bytesToBase64Url(new TextEncoder().encode(`${opts.userName}:${hdIndex}`)),
        name: opts.userName,
        displayName: opts.userDisplayName ?? opts.userName,
      },
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    });

    // pubkey comes back in the create() response; parsed on-device (no verify roundtrip).
    const parsed = parsePasskeyCred(cred, opts.rpId);
    const stored: StoredPasskey = {
      pubX: `0x${parsed.pubX.toString(16)}`,
      pubY: `0x${parsed.pubY.toString(16)}`,
      authenticatorId: parsed.authenticatorId,
      authenticatorIdHash: parsed.authenticatorIdHash,
      rpID: opts.rpId,
    };

    const account = await buildPasskeyKernel(publicClient, owner, hdIndex, stored);
    return { account, passkey: stored };
  } catch {
    // Native passkey flow not exercisable on this binary — caller uses ECDSA.
    return null;
  }
}

/** base64url (no padding) — for the WebAuthn challenge + user id. */
function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  // global btoa is provided by the RN/Hermes runtime + jsPolyfills.
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
