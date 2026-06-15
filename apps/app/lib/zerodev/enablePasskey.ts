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
 *  COUNTERFACTUAL vs DEPLOYED (the two cases, handled differently):
 *    - DEPLOYED Kernel: the sudo validator lives on-chain, so we must swap it
 *      on-chain. We build the CURRENT (ECDSA-sudo) Kernel client and call the SDK's
 *      `changeSudoValidator` with the new passkey validator -> ONE sponsored userOp
 *      (paymaster pays gas; the current ECDSA owner authorizes the swap). Only after
 *      the userOp lands do we persist rec.passkey.
 *    - COUNTERFACTUAL Kernel (never deployed): there is nothing on-chain to change.
 *      The account address was derived from the ECDSA sudo, so we DO NOT change the
 *      address; we persist rec.passkey and kernelForRecord rebuilds the Kernel
 *      address-pinned (passkey sudo, ECDSA regular). The passkey config is baked
 *      into the deploy initcode on the first userOp, which deploys the Kernel.
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

/** Register a NEW device passkey for `rec` and make it the Kernel's sudo validator.
 *  Persists rec.passkey only after the on-chain swap (deployed) succeeds, or
 *  immediately (counterfactual). Idempotent guards: already-passkey / not-smart /
 *  no native module / not configured all return a typed non-throwing result. */
export async function enablePasskeyForRecord(rec: AccountRecord): Promise<EnablePasskeyResult> {
  if (rec.type !== 'smart' || rec.hdIndex == null) {
    return { ok: false, reason: 'error', message: 'Not a smart account.' };
  }
  if (rec.passkey) return { ok: false, reason: 'already' };
  if (!passkeysAvailable()) return { ok: false, reason: 'unavailable' };
  if (!zerodevConfigured()) {
    return { ok: false, reason: 'error', message: 'Smart wallet is not configured.' };
  }

  // 1) Register a NEW passkey credential on-device (the WebAuthn create() prompt).
  let stored: StoredPasskey | null;
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

  const publicClient = makePublicClient();

  // 2) Is the Kernel deployed on-chain? Decides swap-on-chain vs persist-only.
  let deployed = false;
  try {
    const code = await publicClient.getCode({ address: rec.address as `0x${string}` });
    deployed = !!code && code !== '0x';
  } catch {
    deployed = false; // treat unknown as counterfactual (no on-chain swap attempted).
  }

  if (!deployed) {
    // COUNTERFACTUAL: nothing on-chain to change. Persist the passkey; the
    // address-pinned rebuild (kernelForRecord) applies it as sudo and the first
    // userOp deploys the Kernel with the passkey baked in.
    await updateSmartAccount(rec.id, { passkey: stored, passkeyCredId: stored.authenticatorId });
    return { ok: true, deployed: false };
  }

  // 3) DEPLOYED: swap the on-chain sudo validator from the ECDSA owner to the
  //    passkey via one sponsored userOp, authorized by the CURRENT (ECDSA) owner.
  try {
    const owner = await smartOwnerSigner(rec.hdIndex);
    const ecdsaAccount = await createEcdsaKernel(publicClient, owner, rec.hdIndex);
    const kernelClient = makeKernelClient(
      ecdsaAccount as Parameters<typeof makeKernelClient>[0],
      publicClient,
    );
    const passkeyValidator = await passkeyValidatorFromStored(publicClient, stored);
    if (!passkeyValidator) return { ok: false, reason: 'unavailable' };

    // changeSudoValidator is a kernel-client decorator action (sponsored userOp).
    const userOpHash = await (
      kernelClient as unknown as {
        changeSudoValidator: (a: { sudoValidator: unknown }) => Promise<string>;
      }
    ).changeSudoValidator({ sudoValidator: passkeyValidator });

    // The swap is only real once the userOp is MINED and SUCCEEDED on-chain. If we
    // persisted on the hash alone and the op then reverted (paymaster/gas/revert),
    // the record would claim a passkey while on-chain sudo is still the ECDSA key,
    // so kernelForRecord would rebuild a passkey Kernel the chain does not honor
    // (signing fails / silently wrong). Wait for the receipt and require success
    // BEFORE persisting rec.passkey. On failure we do NOT persist -> the account
    // stays a working ECDSA account and the user can retry the enable.
    const receipt = await (
      kernelClient as unknown as {
        waitForUserOperationReceipt: (a: {
          hash: string;
          timeout?: number;
        }) => Promise<{ success: boolean; receipt?: { transactionHash?: string } }>;
      }
    ).waitForUserOperationReceipt({ hash: userOpHash, timeout: 120_000 });
    if (!receipt?.success) {
      return {
        ok: false,
        reason: 'error',
        message: 'Passkey swap userOp did not succeed on-chain; passkey not enabled.',
      };
    }

    // Swap confirmed on-chain: now safe to persist. The on-chain sudo is the passkey.
    await updateSmartAccount(rec.id, { passkey: stored, passkeyCredId: stored.authenticatorId, deployed: true });
    return { ok: true, deployed: true, userOpHash };
  } catch (e) {
    return { ok: false, reason: 'error', message: e instanceof Error ? e.message : 'Could not install passkey on-chain' };
  }
}
