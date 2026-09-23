
import '../cryptoShim';
import type { AccountRecord } from '../accounts';
import { updateSmartAccount } from '../accounts';
import { smartOwnerSigner } from './keyring';
import { makePublicClient, makeKernelClient, swapSudoValidator, type SudoSwapResult } from './client';
import {
  ecdsaValidatorForOwner,
  passkeyKernelResult,
} from './account';
import { passkeysAvailable } from './passkeys';
import { zerodevConfigured } from './env';

export type RemovePasskeyResult =
  | { ok: true; userOpHash: string }
  | { ok: false; reason: 'unavailable' | 'none' | 'error'; message?: string };

export async function swapRootToEcdsa(
  publicClient: ReturnType<typeof makePublicClient>,
  rec: AccountRecord,
): Promise<SudoSwapResult> {
  try {
    if (!rec.passkey || rec.hdIndex == null) {
      return { ok: false, message: 'No passkey on this account.' };
    }
    const owner = await smartOwnerSigner({ hdIndex: rec.hdIndex, phraseId: rec.phraseId });

    const addressOverride = rec.passkeySudo ? undefined : (rec.address as `0x${string}`);
    const passkeyAccount = await passkeyKernelResult(
      publicClient,
      rec.hdIndex,
      rec.passkey,
      addressOverride,
    );
    if ('error' in passkeyAccount) {
      return { ok: false, message: 'Passkey validator unavailable; cannot authorize the revert.' };
    }
    const kernelClient = makeKernelClient(
      passkeyAccount.account,
      publicClient,
    );

    const ecdsaValidator = await ecdsaValidatorForOwner(publicClient, owner);

    const { hash, success } = await swapSudoValidator(kernelClient, ecdsaValidator);
    if (!success) return { ok: false, message: 'Revert userOp did not succeed on-chain; passkey not removed.' };
    return { ok: true, txHash: hash };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Could not revert to key signing on-chain' };
  }
}

export async function removePasskeyFromRecord(rec: AccountRecord): Promise<RemovePasskeyResult> {
  if (rec.type !== 'smart' || rec.hdIndex == null) {
    return { ok: false, reason: 'error', message: 'Not a smart account.' };
  }
  if (!rec.passkey) return { ok: false, reason: 'none' };
  if (!passkeysAvailable()) return { ok: false, reason: 'unavailable' };
  if (!zerodevConfigured()) {
    return { ok: false, reason: 'error', message: 'Smart wallet is not configured.' };
  }

  const publicClient = makePublicClient();

  const swap = await swapRootToEcdsa(publicClient, rec);
  if (!swap.ok) return { ok: false, reason: 'error', message: swap.message };

  await updateSmartAccount(rec.id, {
    passkey: undefined,
    passkeyCredId: undefined,
    passkeySudo: undefined,
  });
  return { ok: true, userOpHash: swap.txHash };
}
