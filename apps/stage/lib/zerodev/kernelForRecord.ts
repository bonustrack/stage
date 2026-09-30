import '../cryptoShim';
import type { Hex } from 'viem';
import type { KernelAccountClient } from '@zerodev/sdk';
import { createEcdsaKernel } from '@stage-labs/client/zerodev/account';
import type { AccountRecord } from '../accounts';
import { smartOwnerSigner } from './keyring';
import { makePublicClient, makeKernelClient } from './client';

export async function kernelClientForRecord(rec: AccountRecord): Promise<KernelAccountClient> {
  if (rec.type !== 'smart' || rec.hdIndex == null) throw new Error('Not a smart account.');
  const publicClient = makePublicClient();
  const owner = await smartOwnerSigner({ hdIndex: rec.hdIndex, phraseId: rec.phraseId });
  const account = await createEcdsaKernel(publicClient, owner, rec.hdIndex, rec.address as Hex);
  return makeKernelClient(account, publicClient);
}
