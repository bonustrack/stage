/** REMOVE PASSKEY from an EXISTING smart account — the exact inverse of
 *  enablePasskey.ts (deployAndSwapToPasskey / enablePasskeyForRecord). Reverts a
 *  passkey-root Kernel back to ECDSA key-signing.
 *
 *  WHY: a user who enabled a passkey may want to go back to plain key signing
 *  (lost device, shared account, or simply no longer wanting the WebAuthn prompt).
 *  This is SECURITY-REDUCING (passkey -> key), so the UI confirms first; the swap
 *  itself is authorized by the CURRENT root signer — the PASSKEY — which proves
 *  possession of the device credential (no extra gate needed: you cannot sign the
 *  swap userOp without the passkey).
 *
 *  ON-CHAIN MECHANISM (the inverse of deployAndSwapToPasskey):
 *    When the passkey was enabled, the ECDSA validator was NOT uninstalled — it was
 *    only DEMOTED from `sudo` to a backup. `ecdsaValidatorStorage` still holds the
 *    owner, and the validator module is still installed on-chain. So reverting is a
 *    single sponsored userOp: build the CURRENT (passkey-sudo) Kernel client and
 *    call `changeSudoValidator({ sudoValidator: ecdsaValidator })` to make the
 *    ECDSA owner root again. The passkey (current root) signs this userOp -> proof
 *    of possession. We wait for the receipt and require on-chain success BEFORE
 *    clearing any stored passkey state.
 *
 *  FAIL-CLOSED: rec.passkey / passkeyCredId / passkeySudo are cleared ONLY after the
 *  receipt confirms success. On any error the account stays a working passkey
 *  account and the user can retry; we never half-clear (which would leave
 *  kernelForRecord unable to decide which validator is root).
 *
 *  ON-DEVICE: building the passkey-sudo Kernel client and signing the swap userOp
 *  run the on-device WebAuthn assertion — not exercisable in CI. */

import '../cryptoShim';
import type { AccountRecord } from '../accounts';
import { updateSmartAccount } from '../accounts';
import { smartOwnerSigner } from './keyring';
import { makePublicClient, makeKernelClient } from './client';
import {
  ecdsaValidatorForOwner,
  passkeyKernelFromStored,
} from './account';
import { passkeysAvailable } from './native';
import { zerodevConfigured } from './env';

export type RemovePasskeyResult =
  | { ok: true; userOpHash: string }
  | { ok: false; reason: 'unavailable' | 'none' | 'error'; message?: string };

/** Result of the on-chain passkey->ECDSA root swap. Mirrors DeployAndSwapResult. */
export type SwapToEcdsaResult =
  | { ok: true; txHash: string }
  | { ok: false; message: string };

/** THE single on-chain place that turns a passkey-sudo Kernel back into an
 *  ECDSA-sudo one. Builds the CURRENT (passkey-sudo) Kernel client at `hdIndex`
 *  (pinned to `address` because the account's address was ECDSA-derived) and issues
 *  ONE sponsored userOp (`changeSudoValidator` -> ECDSA validator). The PASSKEY
 *  (the current root) signs the userOp, proving device possession. Waits for the
 *  receipt and requires on-chain success before returning ok. The inverse of
 *  deployAndSwapToPasskey.
 *
 *  The ECDSA validator is still installed on-chain (it was only demoted at enable
 *  time) and `ecdsaValidatorStorage` still holds the owner, so making it `sudo`
 *  again restores ECDSA root signing. */
export async function swapRootToEcdsa(
  publicClient: ReturnType<typeof makePublicClient>,
  rec: AccountRecord,
): Promise<SwapToEcdsaResult> {
  try {
    if (!rec.passkey || rec.hdIndex == null) {
      return { ok: false, message: 'No passkey on this account.' };
    }
    const owner = await smartOwnerSigner(rec.hdIndex);

    // Build the CURRENT root Kernel = the passkey-sudo Kernel, pinned to the
    // account's (ECDSA-derived) address so the client targets the deployed wallet.
    // passkeyKernelFromStored ignores its `owner` arg (builds from stored pubkey).
    const addressOverride = rec.passkeySudo ? undefined : (rec.address as `0x${string}`);
    const passkeyAccount = await passkeyKernelFromStored(
      publicClient,
      undefined as unknown as Parameters<typeof passkeyKernelFromStored>[1],
      rec.hdIndex,
      rec.passkey,
      addressOverride,
    );
    if (!passkeyAccount) {
      return { ok: false, message: 'Passkey validator unavailable; cannot authorize the revert.' };
    }
    const kernelClient = makeKernelClient(
      passkeyAccount as Parameters<typeof makeKernelClient>[0],
      publicClient,
    );

    // Rebuild the ECDSA validator (the demoted backup) to promote back to sudo.
    const ecdsaValidator = await ecdsaValidatorForOwner(publicClient, owner);

    // changeSudoValidator is a kernel-client decorator action (sponsored userOp).
    // Signed by the PASSKEY (the current root) -> proof of possession.
    const userOpHash = await (
      kernelClient as unknown as {
        changeSudoValidator: (a: { sudoValidator: unknown }) => Promise<string>;
      }
    ).changeSudoValidator({ sudoValidator: ecdsaValidator });

    // The revert is only real once the userOp is MINED and SUCCEEDED on-chain. Wait
    // for the receipt and require success BEFORE the caller clears rec.passkey; on
    // failure the account stays a working passkey account and the user can retry.
    const receipt = await (
      kernelClient as unknown as {
        waitForUserOperationReceipt: (a: {
          hash: string;
          timeout?: number;
        }) => Promise<{ success: boolean; receipt?: { transactionHash?: string } }>;
      }
    ).waitForUserOperationReceipt({ hash: userOpHash, timeout: 120_000 });
    if (!receipt?.success) {
      return { ok: false, message: 'Revert userOp did not succeed on-chain; passkey not removed.' };
    }
    return { ok: true, txHash: userOpHash };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Could not revert to key signing on-chain' };
  }
}

/** Revert `rec` from passkey-root to ECDSA key-signing: swap the sudo validator
 *  back to the ECDSA owner on-chain (one sponsored userOp signed by the passkey),
 *  then — and ONLY after the receipt succeeds — clear rec.passkey / passkeyCredId /
 *  passkeySudo so kernelForRecord rebuilds the ECDSA Kernel. Fail-closed: any error
 *  leaves the account a working passkey account with state intact.
 *
 *  Typed non-throwing guards: not-smart / no-passkey / no native module / not
 *  configured all return a typed result. */
export async function removePasskeyFromRecord(rec: AccountRecord): Promise<RemovePasskeyResult> {
  if (rec.type !== 'smart' || rec.hdIndex == null) {
    return { ok: false, reason: 'error', message: 'Not a smart account.' };
  }
  if (!rec.passkey) return { ok: false, reason: 'none' };
  // The passkey is the current root signer; without the native module we cannot
  // assert it to authorize the swap, so we cannot safely remove it on this binary.
  if (!passkeysAvailable()) return { ok: false, reason: 'unavailable' };
  if (!zerodevConfigured()) {
    return { ok: false, reason: 'error', message: 'Smart wallet is not configured.' };
  }

  const publicClient = makePublicClient();

  // 1) On-chain swap: passkey-sudo -> ECDSA-sudo. Signed by the passkey (proof of
  //    possession). Must SUCCEED on-chain before we clear any state.
  const swap = await swapRootToEcdsa(publicClient, rec);
  if (!swap.ok) return { ok: false, reason: 'error', message: swap.message };

  // 2) Receipt confirmed: NOW it is safe to clear the stored passkey fields. The
  //    on-chain root is the ECDSA owner again; next kernelForRecord builds the ECDSA
  //    Kernel and signing no longer prompts WebAuthn. JSON.stringify drops the
  //    `undefined`-valued keys on persist, so the fields are genuinely removed.
  await updateSmartAccount(rec.id, {
    passkey: undefined,
    passkeyCredId: undefined,
    passkeySudo: undefined,
  });
  return { ok: true, userOpHash: swap.txHash };
}
