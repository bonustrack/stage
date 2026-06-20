
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

export type DeployAndSwapResult =
  | { ok: true; txHash: string }
  | { ok: false; message: string };

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

    const userOpHash = await (
      kernelClient as unknown as {
        changeSudoValidator: (a: { sudoValidator: unknown }) => Promise<string>;
      }
    ).changeSudoValidator({ sudoValidator: passkeyValidator });

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

export async function enablePasskeyForRecord(record: AccountRecord): Promise<EnablePasskeyResult> {
  const guard = passkeyPreflight(record);
  if (guard) return guard;
  const rec = record as AccountRecord & { hdIndex: number };

  const publicClient = makePublicClient();

  const deployed = await isKernelDeployed(publicClient, rec.address);

  if (rec.passkey && deployed) return { ok: false, reason: 'already' };

  const cred = await resolveCredential(rec);
  if ('result' in cred) return cred.result;
  const stored = cred.stored;

  const swap = await deployAndSwapToPasskey(publicClient, rec.hdIndex, stored);
  if (!swap.ok) return { ok: false, reason: 'error', message: swap.message };

  void deployed;
  await updateSmartAccount(rec.id, { passkey: stored, passkeyCredId: stored.authenticatorId, deployed: true });
  return { ok: true, deployed: true, userOpHash: swap.txHash };
}
