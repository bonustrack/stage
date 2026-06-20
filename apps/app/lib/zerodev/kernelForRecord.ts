
import '../cryptoShim';
import type { KernelAccountClient } from '@zerodev/sdk';
import type { AccountRecord } from '../accounts';
import { smartOwnerSigner } from './keyring';
import { makePublicClient, makeKernelClient } from './client';
import { createEcdsaKernel, passkeyKernelFromStored } from './account';
import { passkeysAvailable } from './native';

export async function kernelClientForRecord(rec: AccountRecord): Promise<KernelAccountClient> {
  if (rec.type !== 'smart' || rec.hdIndex == null) {
    throw new Error('Not a smart account.');
  }
  const publicClient = makePublicClient();

  if (rec.passkey) {
    const addressOverride = rec.passkeySudo ? undefined : (rec.address as `0x${string}`);
    const passkeyAccount = await passkeyKernelFromStored(
      publicClient,
      undefined as unknown as Parameters<typeof passkeyKernelFromStored>[1],
      rec.hdIndex,
      rec.passkey,
      addressOverride,
    );
    if (passkeyAccount) return makeKernelClient(passkeyAccount, publicClient);
    if (passkeysAvailable()) {
      throw new Error(
        'Passkey account: passkey validator unavailable; refusing to sign with the ECDSA key.',
      );
    }
    const ownerForOld = await smartOwnerSigner(rec.hdIndex);
    return makeKernelClient(
      await createEcdsaKernel(publicClient, ownerForOld, rec.hdIndex),
      publicClient,
    );
  }

  const owner = await smartOwnerSigner(rec.hdIndex);
  return makeKernelClient(await createEcdsaKernel(publicClient, owner, rec.hdIndex), publicClient);
}
