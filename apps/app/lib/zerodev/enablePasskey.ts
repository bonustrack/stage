/** ENABLE PASSKEY on an EXISTING smart account (so the user need not recreate the
 *  wallet to get a passkey-gated signer).
 *
 *  WHY: an account created on the ECDSA path (no passkey native module at create
 *  time, or passkey skipped) has NO `rec.passkey`, so kernelForRecord builds with
 *  the ECDSA owner as sudo and signing NEVER prompts WebAuthn. This flow registers
 *  a NEW device passkey, makes it the Kernel's `sudo` validator, and persists the
 *  StoredPasskey so every later kernelForRecord rebuilds with the passkey validator
 *  (the ECDSA owner becomes the `regular` backup). After this, tx/message/userOp
 *  signing all route through the on-device WebAuthn prompt.
 *
 *  ONE on-chain path for BOTH counterfactual + deployed (Less's root-cause fix):
 *    We ALWAYS swap the sudo validator on-chain via the SDK's `changeSudoValidator`
 *    on the CURRENT (ECDSA-sudo) Kernel client -> ONE sponsored userOp (paymaster
 *    pays gas; the current ECDSA owner authorizes the swap). For a COUNTERFACTUAL
 *    account this SAME userOp first deploys the Kernel (with the ECDSA initCode, so
 *    the factory deploys to the ECDSA-derived address that the record already uses)
 *    AND changes the root validator to the passkey, in one bundle. Only after the
 *    userOp lands do we persist rec.passkey.
 *
 *    WHY NOT the old "counterfactual = persist + address-pin" shortcut: pinning a
 *    passkey-sudo Kernel to the ECDSA-derived address is UNSATISFIABLE. The sudo
 *    validator is part of the Kernel's CREATE2 salt, so a passkey-sudo initCode
 *    deploys to a DIFFERENT address than the ECDSA-derived `rec.address`. The first
 *    userOp's deploy half then reverts in the meta-factory with `Unauthorized`
 *    (salt/sender mismatch) -> the on-device "Unauthorized" toast, even though the
 *    passkey signs fine. signMessage masked it: ERC-6492 validates that initCode
 *    OFF-CHAIN (eth_call) and never asks the factory to deploy at a pinned address.
 *    Deploying with the ECDSA initCode (address matches) then swapping sudo avoids
 *    the mismatch entirely.
 *
 *  ON-DEVICE: the WebAuthn create() prompt (registration) and, for the deployed
 *  case, the userOp signing happen on-device only — this cannot be exercised in CI.
 *  The mnemonic never leaves the keyring; the ECDSA owner only authorizes the swap. */

import '../cryptoShim';
import type { AccountRecord } from '../accounts';
import { updateSmartAccount } from '../accounts';
import { smartOwnerSigner } from './keyring';
import { makePublicClient, makeKernelClient } from './client';
import {
  createEcdsaKernel,
  registerPasskeyCredential,
  passkeyValidatorFromStored,
  type StoredPasskey,
} from './account';
import { passkeysAvailable } from './native';
import { zerodevConfigured, zerodevRpId } from './env';

export type EnablePasskeyResult =
  | { ok: true; deployed: boolean; userOpHash?: string }
  | { ok: false; reason: 'unavailable' | 'already' | 'cancelled' | 'error'; message?: string };

/** Result of the shared on-chain deploy-and-swap. `txHash` is the swap userOp hash
 *  (also used as the diagnostic tx reference). `ok:false` carries a human message. */
export type DeployAndSwapResult =
  | { ok: true; txHash: string }
  | { ok: false; message: string };

/** THE single on-chain place that turns an ECDSA-sudo Kernel into a passkey-sudo
 *  one. Builds the CURRENT (ECDSA-sudo) Kernel client at `hdIndex` and issues ONE
 *  sponsored userOp (`changeSudoValidator` -> passkey). For a COUNTERFACTUAL Kernel
 *  this same userOp first DEPLOYS the Kernel with the ECDSA initCode (so the factory
 *  deploys to the ECDSA-derived address the record uses) AND swaps the root validator
 *  to the passkey, in one bundle. Waits for the receipt and requires on-chain
 *  success before returning ok. Shared by the Settings enable path AND the onboarding
 *  create path so the proven logic lives in ONE place.
 *
 *  ON-DEVICE: the userOp signing (ECDSA owner authorizes the swap) and, for the
 *  create path, the preceding WebAuthn registration are device-only — not in CI. */
export async function deployAndSwapToPasskey(
  publicClient: ReturnType<typeof makePublicClient>,
  hdIndex: number,
  stored: StoredPasskey,
): Promise<DeployAndSwapResult> {
  try {
    const owner = await smartOwnerSigner(hdIndex);
    const ecdsaAccount = await createEcdsaKernel(publicClient, owner, hdIndex);
    const kernelClient = makeKernelClient(
      ecdsaAccount,
      publicClient,
    );
    const passkeyValidator = await passkeyValidatorFromStored(publicClient, stored);
    if (!passkeyValidator) return { ok: false, message: 'Passkey validator unavailable.' };

    // changeSudoValidator is a kernel-client decorator action (sponsored userOp).
    const userOpHash = await (
      kernelClient as unknown as {
        changeSudoValidator: (a: { sudoValidator: unknown }) => Promise<string>;
      }
    ).changeSudoValidator({ sudoValidator: passkeyValidator });

    // The swap is only real once the userOp is MINED and SUCCEEDED on-chain. Wait
    // for the receipt and require success BEFORE the caller persists rec.passkey; on
    // failure the account stays a working ECDSA account and the user can retry.
    const receipt = await (
      kernelClient as unknown as {
        waitForUserOperationReceipt: (a: {
          hash: string;
          timeout?: number;
        }) => Promise<{ success: boolean; receipt?: { transactionHash?: string } }>;
      }
    ).waitForUserOperationReceipt({ hash: userOpHash, timeout: 120_000 });
    if (!receipt?.success) {
      return { ok: false, message: 'Passkey swap userOp did not succeed on-chain; passkey not enabled.' };
    }
    return { ok: true, txHash: userOpHash };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Could not install passkey on-chain' };
  }
}

/** Register a NEW device passkey for `rec` and make it the Kernel's sudo validator.
 *  Persists rec.passkey only after the on-chain swap userOp succeeds (deploy +
 *  swap for a counterfactual account, swap-only for a deployed one). Idempotent
 *  guards: passkey-already-installed-on-chain / not-smart / no native module /
 *  not configured all return a typed non-throwing result. A record that carries a
 *  passkey but is NOT deployed (the old broken counterfactual shortcut) is repaired
 *  by reusing the stored credential and running the deploy-and-swap. */
export async function enablePasskeyForRecord(rec: AccountRecord): Promise<EnablePasskeyResult> {
  if (rec.type !== 'smart' || rec.hdIndex == null) {
    return { ok: false, reason: 'error', message: 'Not a smart account.' };
  }
  if (!passkeysAvailable()) return { ok: false, reason: 'unavailable' };
  if (!zerodevConfigured()) {
    return { ok: false, reason: 'error', message: 'Smart wallet is not configured.' };
  }

  const publicClient = makePublicClient();

  // Was the Kernel already deployed on-chain? Reported on success for the UI; also
  // decides the `already` vs `repair` case for a record that ALREADY has a passkey.
  let deployed = false;
  try {
    const code = await publicClient.getCode({ address: rec.address as `0x${string}` });
    deployed = !!code && code !== '0x';
  } catch {
    deployed = false;
  }

  // REPAIR vs ALREADY for a record that already carries a passkey:
  //   - DEPLOYED  -> the on-chain sudo is really the passkey; genuinely done.
  //   - NOT deployed -> the OLD counterfactual shortcut persisted rec.passkey but
  //     never installed it on-chain (and address-pinning it is unsatisfiable). Run
  //     the deploy-and-swap below REUSING the stored credential (no re-register),
  //     so the Kernel deploys (ECDSA initCode) and the sudo becomes the passkey.
  if (rec.passkey && deployed) return { ok: false, reason: 'already' };

  // 1) Get the passkey credential to install: reuse the stored one on the repair
  //    path, else register a NEW credential on-device (the WebAuthn create() prompt).
  let stored: StoredPasskey | null;
  if (rec.passkey) {
    stored = rec.passkey;
  } else {
    try {
      stored = await registerPasskeyCredential(rec.hdIndex, {
        rpId: zerodevRpId(),
        userName: rec.label?.trim() || `stage-${rec.hdIndex}`,
      });
    } catch (e) {
      return { ok: false, reason: 'error', message: e instanceof Error ? e.message : 'Passkey registration failed' };
    }
    // null => the user cancelled the OS sheet or the native flow is not exercisable.
    if (!stored) return { ok: false, reason: 'cancelled' };
  }

  // 2) Swap the sudo validator from the ECDSA owner to the passkey via the SHARED
  //    on-chain deploy-and-swap (one sponsored userOp; deploys the Kernel first with
  //    the ECDSA initCode for a counterfactual account). Same logic the onboarding
  //    create path uses, so the proven flow lives in exactly one place.
  const swap = await deployAndSwapToPasskey(publicClient, rec.hdIndex, stored);
  if (!swap.ok) return { ok: false, reason: 'error', message: swap.message };

  // Swap confirmed on-chain: now safe to persist. The on-chain sudo is the passkey
  // and (counterfactual or not) the Kernel is now deployed.
  void deployed; // recorded pre-swap for diagnostics; the op deploys when needed.
  await updateSmartAccount(rec.id, { passkey: stored, passkeyCredId: stored.authenticatorId, deployed: true });
  return { ok: true, deployed: true, userOpHash: swap.txHash };
}
