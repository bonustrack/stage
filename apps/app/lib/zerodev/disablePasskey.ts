/** @file Reverts a passkey-root smart account back to ECDSA key-signing via a single passkey-signed `changeSudoValidator` userOp promoting the still-installed ECDSA validator to sudo; fail-closed, clearing stored passkey state only after the receipt succeeds. */

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

/** The single on-chain swap turning a passkey-sudo Kernel back into ECDSA-sudo via one sponsored `changeSudoValidator` userOp signed by the passkey, requiring on-chain success before returning ok. */
export async function swapRootToEcdsa(
  publicClient: ReturnType<typeof makePublicClient>,
  rec: AccountRecord,
): Promise<SwapToEcdsaResult> {
  try {
    if (!rec.passkey || rec.hdIndex == null) {
      return { ok: false, message: 'No passkey on this account.' };
    }
    const owner = await smartOwnerSigner(rec.hdIndex);

    /** Build the current passkey-sudo Kernel, pinned to the account's ECDSA-derived address so the client targets the deployed wallet; passkeyKernelFromStored builds from the stored pubkey. */
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
      passkeyAccount,
      publicClient,
    );

    /** Rebuild the ECDSA validator (the demoted backup) to promote back to sudo. */
    const ecdsaValidator = await ecdsaValidatorForOwner(publicClient, owner);

    /** changeSudoValidator is a kernel-client decorator action (sponsored userOp) signed by the passkey (current root) as proof of possession. */
    const userOpHash = await (
      kernelClient as unknown as {
        changeSudoValidator: (a: { sudoValidator: unknown }) => Promise<string>;
      }
    ).changeSudoValidator({ sudoValidator: ecdsaValidator });

    /** The revert is only real once the userOp is mined and succeeded on-chain, so require receipt success before the caller clears rec.passkey; on failure the account stays a working passkey account. */
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

/** Reverts `rec` from passkey-root to ECDSA signing on-chain, then clears the stored passkey fields only after the receipt succeeds; fail-closed with typed non-throwing guards for not-smart, no-passkey, no native module, and not-configured. */
export async function removePasskeyFromRecord(rec: AccountRecord): Promise<RemovePasskeyResult> {
  if (rec.type !== 'smart' || rec.hdIndex == null) {
    return { ok: false, reason: 'error', message: 'Not a smart account.' };
  }
  if (!rec.passkey) return { ok: false, reason: 'none' };
  /** The passkey is the current root signer; without the native module we cannot assert it to authorize the swap, so it can't be safely removed on this binary. */
  if (!passkeysAvailable()) return { ok: false, reason: 'unavailable' };
  if (!zerodevConfigured()) {
    return { ok: false, reason: 'error', message: 'Smart wallet is not configured.' };
  }

  const publicClient = makePublicClient();

  /** 1) On-chain swap passkey-sudo -> ECDSA-sudo, signed by the passkey (proof of possession), which must succeed on-chain before any state is cleared. */
  const swap = await swapRootToEcdsa(publicClient, rec);
  if (!swap.ok) return { ok: false, reason: 'error', message: swap.message };

  /** 2) Receipt confirmed: now safe to clear the stored passkey fields so the next kernelForRecord builds the ECDSA Kernel; JSON.stringify drops the undefined-valued keys on persist, genuinely removing them. */
  await updateSmartAccount(rec.id, {
    passkey: undefined,
    passkeyCredId: undefined,
    passkeySudo: undefined,
  });
  return { ok: true, userOpHash: swap.txHash };
}
