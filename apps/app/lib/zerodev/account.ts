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
 *  the sole active signer; ECDSA owner is recovery-only, not installed) plus the
 *  StoredPasskey to persist on the record. */
export interface PasskeyKernelResult {
  account: CreateKernelAccountReturnType;
  passkey: StoredPasskey;
}

/** The passkey WebAuthnValidator contract version. MUST be a real member of the
 *  installed @zerodev/passkey-validator `PasskeyValidatorContractVersion` enum.
 *
 *  ROOT-CAUSE GUARD: the enum members are `V0_0_1_UNPATCHED` / `V0_0_2_UNPATCHED`
 *  / `V0_0_3_PATCHED` — there is NO `V0_0_2`. Referencing the (untyped, lazy
 *  `require`d) enum with `.V0_0_2` yields `undefined`, so toPasskeyValidator ->
 *  getValidatorAddress cannot find a validator address ("Validator not found for
 *  Kernel version: 0.3.1") and THROWS. That throw was swallowed by the rebuild's
 *  catch, surfacing to the caller as "passkey validator unavailable" even though
 *  the stored passkey is perfectly reconstructable. Resolve the version by VALUE
 *  ("0.0.2") so a future enum-name change can't reintroduce the typo, and so the
 *  counterfactual validator address (baked into the deploy initcode) is unchanged
 *  from the value the create/enable paths always intended. */
function passkeyContractVersion(
  PasskeyValidatorContractVersion: Record<string, string>,
): string {
  // Match by the string VALUE the protocol uses on-chain (Kernel v3.1 supports
  // "0.0.1" | "0.0.2" | "0.0.3"); "0.0.2" is the version this wallet was built on.
  const byValue = Object.values(PasskeyValidatorContractVersion).find((v) => v === '0.0.2');
  if (!byValue) throw new Error('Passkey validator contract version 0.0.2 not found in installed SDK');
  return byValue;
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
 *  whose ONLY active validator is that passkey — the mnemonic-derived ECDSA owner
 *  is NOT installed as a `regular` validator. Used by BOTH the create path (right
 *  after registration) and the rebuild path (later launches).
 *
 *  WHY NO `regular` (the root-cause fix): the ZeroDev plugin manager picks the
 *  ACTIVE signer as `regular || sudo` (toKernelPluginManager). If we passed the
 *  ECDSA owner as `regular`, EVERY signature (sendTransaction / userOp /
 *  signMessage / signTypedData, and so the XMTP SCW signer) would route through
 *  the ECDSA key and the passkey would NEVER be exercised — exactly the bug where
 *  a configured passkey still signed with the private key. With sudo=passkey and
 *  no regular, `regular || sudo` resolves to the passkey, so the passkey is the
 *  ACTIVE signer for everything and the mnemonic is never read for signing. The
 *  ECDSA owner stays recovery-only: guardian social recovery (./recovery) rotates
 *  the `sudo` validator via its own weighted-ECDSA validator on the recovery
 *  action selector — it does not rely on the `regular` slot.
 *
 *  Lazy requires keep this file bundling/typechecking without the passkey deps. */
async function buildPasskeyKernel(
  publicClient: PublicClient,
  _owner: HDAccount,
  hdIndex: number,
  stored: StoredPasskey,
  /** When the account ALREADY exists (enable-passkey on an account whose address
   *  was derived from the ECDSA sudo validator), pin the Kernel to that address so
   *  swapping sudo to the passkey does NOT change the wallet identity. Omitted on
   *  the fresh-create path, where the passkey IS the sudo the address derives from. */
  addressOverride?: `0x${string}`,
): Promise<CreateKernelAccountReturnType> {
  const { toPasskeyValidator, PasskeyValidatorContractVersion } = require('@zerodev/passkey-validator');
  const passkeyValidator = await toPasskeyValidator(publicClient, {
    webAuthnKey: liveWebAuthnKey(stored),
    entryPoint: ENTRY_POINT,
    kernelVersion: KERNEL_VERSION,
    validatorContractVersion: passkeyContractVersion(PasskeyValidatorContractVersion),
  });
  return createKernelAccount(publicClient, {
    // sudo = passkey, NO regular: the passkey is the sole ACTIVE signer (see above).
    plugins: { sudo: passkeyValidator },
    entryPoint: ENTRY_POINT,
    kernelVersion: KERNEL_VERSION,
    ...(addressOverride ? { address: addressOverride } : { index: BigInt(hdIndex) }),
  });
}

/** Build JUST the passkey KernelValidator from stored material (no Kernel account).
 *  Used by the enable-passkey flow to install/swap the validator on an existing,
 *  deployed Kernel via the SDK's changeSudoValidator. Null when the native module
 *  is absent. Lazy require keeps this bundling without the passkey deps. */
export async function passkeyValidatorFromStored(
  publicClient: PublicClient,
  stored: StoredPasskey,
): Promise<unknown | null> {
  if (!passkeysAvailable()) return null;
  try {
    const { toPasskeyValidator, PasskeyValidatorContractVersion } = require('@zerodev/passkey-validator');
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

/** REGISTER a NEW passkey credential for an EXISTING account WITHOUT building a
 *  Kernel (the enable-passkey flow). Runs the on-device WebAuthn create() (the
 *  native prompt) and returns the StoredPasskey to persist + install. Null when
 *  the native module is absent. Mirrors createPasskeyKernel's registration half. */
export async function registerPasskeyCredential(
  hdIndex: number,
  opts: { rpId: string; userName: string; userDisplayName?: string },
): Promise<StoredPasskey | null> {
  if (!passkeysAvailable()) return null;
  try {
    const passkey = require('react-native-passkeys');
    const { parsePasskeyCred } = require('@zerodev/react-native-passkeys-utils');
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
  /** The account's known address. REQUIRED for accounts whose passkey was added
   *  AFTER creation (the address was derived from the ECDSA sudo, not the passkey),
   *  so the rebuilt passkey-sudo Kernel resolves to the SAME identity. Pass the
   *  record address always; harmless on fresh passkey accounts (same address). */
  addressOverride?: `0x${string}`,
): Promise<CreateKernelAccountReturnType | null> {
  if (!passkeysAvailable()) return null;
  try {
    return await buildPasskeyKernel(publicClient, owner, hdIndex, stored, addressOverride);
  } catch (e) {
    // Native module IS present but reconstruction failed: this is a real bug, not
    // an old binary. Surface it in dev so it can't masquerade as "native absent"
    // (the regression this whole path guards against). Caller still fails closed.
    if (__DEV__) console.warn('[zerodev] passkey kernel rebuild failed:', e);
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

/** REVEAL-GATE passkey assertion. Runs an on-device WebAuthn `get()` over a fresh
 *  random challenge, scoped to THIS account's stored credential (rpID +
 *  authenticatorId) with `userVerification: 'required'`, so the OS prompts for the
 *  passkey + biometric/PIN and the credential must actually be present. We do not
 *  consume the returned assertion — its mere SUCCESS proves passkey presence +
 *  user verification, which is the gate for revealing the seed/key.
 *
 *  Returns:
 *    - true  -> assertion succeeded (gate passes).
 *    - false -> assertion was cancelled / failed / returned no credential (gate
 *               fails; caller MUST NOT reveal the secret).
 *    - null  -> the running binary lacks the passkey native module, so we cannot
 *               assert at all; caller falls back to the device-auth sentinel so an
 *               old binary still works (it never crashes).
 *
 *  Lazy require keeps this bundling/typechecking without react-native-passkeys. */
export async function assertPasskeyPresence(stored: StoredPasskey): Promise<boolean | null> {
  if (!passkeysAvailable()) return null;
  try {
    const passkey = require('react-native-passkeys');
    const challengeBytes = new Uint8Array(32);
    crypto.getRandomValues(challengeBytes);
    const assertion = await passkey.get({
      challenge: bytesToBase64Url(challengeBytes),
      rpId: stored.rpID,
      allowCredentials: [{ id: stored.authenticatorId, type: 'public-key' }],
      userVerification: 'required',
    });
    // A null result means no credential was returned (treat as a failed gate);
    // a cancel/error throws and is caught below.
    return !!assertion;
  } catch {
    return false;
  }
}

/** base64url (no padding) — for the WebAuthn challenge + user id. */
function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  // global btoa is provided by the RN/Hermes runtime + jsPolyfills.
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
