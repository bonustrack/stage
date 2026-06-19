/**
 * @file Enables a device passkey on an existing smart account by swapping the Kernel's sudo validator to the passkey via one sponsored userOp (deploying the counterfactual Kernel with the ECDSA initCode in the same bundle when needed), then persisting the StoredPasskey so all later signing routes through WebAuthn.
 */

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

/** Result of the shared on-chain deploy-and-swap. `txHash` is the swap userOp hash (also used as the diagnostic tx reference). `ok:false` carries a human message. */
export type DeployAndSwapResult =
  | { ok: true; txHash: string }
  | { ok: false; message: string };

/**
 * THE single on-chain place that turns an ECDSA-sudo Kernel into a passkey-sudo
 *  one. Builds the CURRENT (ECDSA-sudo) Kernel client at `hdIndex` and issues ONE
 *  sponsored userOp (`changeSudoValidator` -> passkey). For a COUNTERFACTUAL Kernel
 *  this same userOp first DEPLOYS the Kernel with the ECDSA initCode (so the factory
 *  deploys to the ECDSA-derived address the record uses) AND swaps the root validator
 *  to the passkey, in one bundle. Waits for the receipt and requires on-chain
 *  success before returning ok. Shared by the Settings enable path AND the onboarding
 *  create path so the proven logic lives in ONE place.
 *
 *  ON-DEVICE: the userOp signing (ECDSA owner authorizes the swap) and, for the
 *  create path, the preceding WebAuthn registration are device-only — not in CI.
 */
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

/** Pre-flight guard: typed reject when `rec` can't take a passkey (not smart / no native module / not configured). null means proceed. */
function passkeyPreflight(rec: AccountRecord): EnablePasskeyResult | null {
  if (rec.type !== 'smart' || rec.hdIndex == null) {
    return { ok: false, reason: 'error', message: 'Not a smart account.' };
  }
  if (!passkeysAvailable()) return { ok: false, reason: 'unavailable' };
  if (!zerodevConfigured()) {
    return { ok: false, reason: 'error', message: 'Smart wallet is not configured.' };
  }
  return null;
}

/** Whether the Kernel is already deployed on-chain (has bytecode); false on any read error. */
async function isKernelDeployed(
  publicClient: ReturnType<typeof makePublicClient>,
  address: string,
): Promise<boolean> {
  try {
    const code = await publicClient.getCode({ address: address as `0x${string}` });
    return !!code && code !== '0x';
  } catch {
    return false;
  }
}

/** Either the result of resolving a StoredPasskey to install, or a typed early-return outcome. */
type CredentialResolution =
  | { stored: StoredPasskey }
  | { result: EnablePasskeyResult };

/** Reuse the record's stored passkey on the repair path, else register a NEW on-device credential (the WebAuthn create() prompt). */
async function resolveCredential(rec: AccountRecord & { hdIndex: number }): Promise<CredentialResolution> {
  if (rec.passkey) return { stored: rec.passkey };
  let stored: StoredPasskey | null;
  try {
    stored = await registerPasskeyCredential(rec.hdIndex, {
      rpId: zerodevRpId(),
      userName: rec.label?.trim() ? rec.label.trim() : `stage-${rec.hdIndex}`,
    });
  } catch (e) {
    return { result: { ok: false, reason: 'error', message: e instanceof Error ? e.message : 'Passkey registration failed' } };
  }
  // null => the user cancelled the OS sheet or the native flow is not exercisable.
  if (!stored) return { result: { ok: false, reason: 'cancelled' } };
  return { stored };
}

/** Register/reuse a device passkey for `rec` and make it the Kernel's sudo validator, persisting only after the on-chain swap succeeds; idempotent guards return typed non-throwing results. */
export async function enablePasskeyForRecord(record: AccountRecord): Promise<EnablePasskeyResult> {
  const guard = passkeyPreflight(record);
  if (guard) return guard;
  // preflight guarantees smart + non-null hdIndex.
  const rec = record as AccountRecord & { hdIndex: number };

  const publicClient = makePublicClient();

  // Was the Kernel already deployed on-chain? Reported on success for the UI; also
  // decides the `already` vs `repair` case for a record that ALREADY has a passkey.
  const deployed = await isKernelDeployed(publicClient, rec.address);

  // REPAIR vs ALREADY for a record that already carries a passkey:
  //   - DEPLOYED  -> the on-chain sudo is really the passkey; genuinely done.
  //   - NOT deployed -> the OLD counterfactual shortcut persisted rec.passkey but
  //     never installed it on-chain (and address-pinning it is unsatisfiable). Run
  //     the deploy-and-swap below REUSING the stored credential (no re-register),
  //     so the Kernel deploys (ECDSA initCode) and the sudo becomes the passkey.
  if (rec.passkey && deployed) return { ok: false, reason: 'already' };

  // 1) Get the passkey credential to install.
  const cred = await resolveCredential(rec);
  if ('result' in cred) return cred.result;
  const stored = cred.stored;

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
