
import '../cryptoShim';
import type { AccountRecord } from '../accounts';
import { updateSmartAccount } from '../accounts';
import { smartOwnerSigner, type SmartKeyRef } from './keyring';
import { makePublicClient, makeKernelClient, swapSudoValidator } from './client';
import {
  createEcdsaKernel,
  passkeyValidatorFromStored,
} from './account';
import { passkeysAvailable, registerPasskeyCredential } from './passkeys';
import { accountPasskey, dropMismatchedPasskey, kernelCustody, linkPasskeyForRecord, storedPasskeyMatches } from './linkPasskey';
import { type StoredPasskey } from './passkeys.model';
import { zerodevConfigured, zerodevRpId } from './env';
import { txErrorMessage } from '@stage-labs/client/wallet/txError';

const SWAP_FALLBACK = 'Could not install the passkey on-chain.';
const SECURED_ELSEWHERE = 'This account is secured by a passkey on another device. Use that passkey to continue.';

function swapFailureMessage(e: unknown): string {
  const message = txErrorMessage(e, SWAP_FALLBACK);
  return /signature rejected/i.test(message) ? SECURED_ELSEWHERE : message;
}

export type EnablePasskeyResult =
  | { ok: true; deployed: boolean; userOpHash?: string }
  | { ok: false; reason: 'unavailable' | 'already' | 'cancelled' | 'error'; message?: string };

export type DeployAndSwapResult =
  | { ok: true; txHash: string }
  | { ok: false; message: string };

export async function deployAndSwapToPasskey(
  publicClient: ReturnType<typeof makePublicClient>,
  key: SmartKeyRef,
  stored: StoredPasskey,
): Promise<DeployAndSwapResult> {
  try {
    const owner = await smartOwnerSigner(key);
    const ecdsaAccount = await createEcdsaKernel(publicClient, owner, key.hdIndex);
    const kernelClient = makeKernelClient(
      ecdsaAccount,
      publicClient,
    );
    const passkeyValidator = await passkeyValidatorFromStored(publicClient, stored);
    if (!passkeyValidator) return { ok: false, message: 'Passkey validator unavailable.' };

    const { hash, success } = await swapSudoValidator(kernelClient, passkeyValidator);
    if (!success) return { ok: false, message: 'Passkey swap userOp did not succeed on-chain; passkey not enabled.' };
    return { ok: true, txHash: hash };
  } catch (e) {
    return { ok: false, message: swapFailureMessage(e) };
  }
}

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

async function linkInsteadOfMinting(rec: AccountRecord): Promise<EnablePasskeyResult> {
  const linked = await linkPasskeyForRecord(rec);
  if (linked.ok) return { ok: true, deployed: true };
  if (linked.reason === 'cancelled') return { ok: false, reason: 'cancelled' };
  if (linked.reason === 'unavailable') return { ok: false, reason: 'unavailable' };
  return { ok: false, reason: 'error', message: linked.message ?? SECURED_ELSEWHERE };
}

type CredentialResolution =
  | { stored: StoredPasskey }
  | { result: EnablePasskeyResult };

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
  if (!stored) return { result: { ok: false, reason: 'cancelled' } };
  return { stored };
}

async function forgetPasskeyUnlessRoot(id: string, address: `0x${string}`): Promise<void> {
  if ((await kernelCustody(address).catch(() => null)) === 'passkey-root') return;
  await updateSmartAccount(id, { passkey: undefined, passkeyCredId: undefined });
}

export async function enablePasskeyForRecord(record: AccountRecord): Promise<EnablePasskeyResult> {
  const guard = passkeyPreflight(record);
  if (guard) return guard;
  const rec = record as AccountRecord & { hdIndex: number };

  const publicClient = makePublicClient();
  const address = rec.address as `0x${string}`;
  let custody: Awaited<ReturnType<typeof kernelCustody>>;
  try {
    custody = await kernelCustody(address);
  } catch (e) {
    return { ok: false, reason: 'error', message: txErrorMessage(e, 'Could not read the account onchain. Check your connection and try again.') };
  }
  if (custody === 'other-root') return { ok: false, reason: 'error', message: 'This account is controlled by another signer, so a passkey cannot be added here.' };
  if (custody === 'passkey-root') {
    const key = await accountPasskey(address);
    if (storedPasskeyMatches(rec, key)) return { ok: false, reason: 'already' };
    await dropMismatchedPasskey(rec, key);
    return linkInsteadOfMinting(rec);
  }

  const cred = await resolveCredential(rec);
  if ('result' in cred) return cred.result;
  const stored = cred.stored;
  const storedHere = !rec.passkey;
  if (storedHere) {
    await updateSmartAccount(rec.id, { passkey: stored, passkeyCredId: stored.authenticatorId });
  }

  const swap = await deployAndSwapToPasskey(publicClient, { hdIndex: rec.hdIndex, phraseId: rec.phraseId }, stored);
  if (!swap.ok) {
    if (storedHere) await forgetPasskeyUnlessRoot(rec.id, address);
    return { ok: false, reason: 'error', message: swap.message };
  }

  await updateSmartAccount(rec.id, { passkey: stored, passkeyCredId: stored.authenticatorId, deployed: true });
  return { ok: true, deployed: true, userOpHash: swap.txHash };
}
