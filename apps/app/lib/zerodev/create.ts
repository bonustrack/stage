/** Orchestrates creating a new smart (ZeroDev Kernel) account from the single
 *  app mnemonic: ensure the mnemonic, derive the owner at the next HD index,
 *  build the counterfactual Kernel (passkey `sudo` when the native module is
 *  present, ECDSA owner `sudo` otherwise), and persist the registry record.
 *
 *  Thin glue over ./mnemonic + ./account + accounts.ts. No tx is sent — the
 *  Kernel deploys lazily on the first sponsored userOp (phase 2). */

import '../cryptoShim';
import { addSmartAccount, nextSmartHdIndex, type AccountRecord } from '../accounts';
import { ensureMnemonic, smartOwnerSigner } from './keyring';
import { makePublicClient } from './client';
import { createEcdsaKernel, registerPasskeyCredential } from './account';
import { deployAndSwapToPasskey } from './enablePasskey';
import { passkeysAvailable } from './native';
import { zerodevConfigured } from './env';

export interface CreateSmartAccountOpts {
  /** Passkey relying-party id (the hosted domain, e.g. 'stage.box' / 'metro.box').
   *  Only used when the passkey native module is available. */
  rpId?: string;
  /** Human label for the WebAuthn user (display only). */
  userName?: string;
  label?: string;
}

/** Create + persist a new smart account. Uses the passkey path when available
 *  (user accounts on the new APK), else the ECDSA owner path (always works).
 *  Returns the new record (active). Throws if ZeroDev is not configured. */
export async function createSmartAccount(opts: CreateSmartAccountOpts = {}): Promise<AccountRecord> {
  if (!zerodevConfigured()) {
    throw new Error('Smart wallet is not configured (missing ZeroDev project).');
  }
  // Minting/reading the mnemonic prompts device auth — acceptable here
  // (new-account path). The owner signer is derived inside the keyring.
  await ensureMnemonic();
  const hdIndex = await nextSmartHdIndex();
  const owner = await smartOwnerSigner(hdIndex);
  const publicClient = makePublicClient();

  // ALWAYS build the ECDSA Kernel first: its address derives from the ECDSA owner
  // (no passkey in the CREATE2 salt) so it is DEPLOYABLE at exactly this address.
  // The passkey branch below deploys-and-swaps at this same address in one step;
  // the key-only branch keeps it as the ECDSA-sudo account.
  const account = await createEcdsaKernel(publicClient, owner, hdIndex);
  const address = account.address;

  let passkey: AccountRecord['passkey'];
  let deployed = false;
  if (passkeysAvailable() && opts.rpId) {
    // PASSKEY REQUESTED + the native module is present: the account MUST end up a
    // DEPLOYED, passkey-sudo Kernel or creation MUST fail (fail-closed, no silent
    // ECDSA fallback — matching the old createPasskeyKernel contract). We reuse the
    // PROVEN enable path: register a device passkey, then deploy-and-swap the sudo
    // validator to it via ONE sponsored userOp on the ECDSA-derived (deployable)
    // address. This avoids the unsatisfiable counterfactual passkey-AS-ROOT Kernel
    // (passkey in the CREATE2 salt) whose deploy half reverted Unauthorized.
    const stored = await registerPasskeyCredential(hdIndex, {
      rpId: opts.rpId,
      userName: opts.userName ?? `stage-${hdIndex}`,
    });
    // null => the user cancelled the OS sheet or the native flow is not exercisable;
    // fail closed rather than silently create an ECDSA-only account.
    if (!stored) throw new Error('Passkey registration was cancelled.');

    const swap = await deployAndSwapToPasskey(publicClient, hdIndex, stored);
    if (!swap.ok) throw new Error(swap.message);

    // Persist the public WebAuthn material so the passkey validator (the ACTIVE
    // signer) can be rebuilt on every later launch without re-registering.
    passkey = stored;
    deployed = true;
  }

  const rec: AccountRecord = {
    id: address.toLowerCase(),
    address,
    type: 'smart',
    label: opts.label,
    dbDir: `xmtp-${address.toLowerCase()}`,
    registered: false,
    createdAt: Date.now(),
    hdIndex,
    ownerAddress: owner.address.toLowerCase(),
    // The passkey branch deploys-and-swaps on-chain in one step, so the Kernel is
    // already deployed; the key-only branch stays counterfactual until its first op.
    deployed,
    // When a passkey was registered it is the sudo signer; persist the material so
    // kernelClientForRecord rebuilds with the passkey validator (not the ECDSA key).
    passkey,
    passkeyCredId: passkey?.authenticatorId,
    // passkeySudo is INTENTIONALLY UNSET: the account was deployed at the
    // ECDSA-DERIVED address (deployable initCode) and the sudo was swapped to the
    // passkey, exactly like the Settings enable path. So kernelForRecord must PIN to
    // rec.address (passkeySudo unset) rather than re-derive a passkey-sudo address.
    scwXmtp: true, // SCW IS the XMTP identity by default (Less): Kernel address
    //              registers via ERC-1271 / 6492-while-counterfactual, chainId 8453.

  };
  return addSmartAccount(rec);
}
