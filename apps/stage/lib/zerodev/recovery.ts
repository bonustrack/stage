
import '../cryptoShim';
import type { Address, PublicClient } from 'viem';
import { createKernelAccount } from '@zerodev/sdk';
import { createWeightedECDSAValidator, getRecoveryAction, getUpdateConfigCall } from '@zerodev/weighted-ecdsa-validator';
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import { ENTRY_POINT, KERNEL_VERSION } from '@stage-labs/client/zerodev/account';
import {
  weightedConfigFor, type WeightedConfig, DEFAULT_RECOVERY_DELAY_SECONDS,
} from '@stage-labs/client/zerodev/recovery';
import type { AccountRecord } from '../accounts';
import { updateSmartAccount } from '../accounts';
import { smartOwnerSigner } from './keyring';
import { makePublicClient, makeKernelClient } from './client';
import { createEcdsaKernel } from './account';

async function buildGuardianValidator(publicClient: PublicClient, cfg: WeightedConfig, signers: { address: Address }[] = []) {
  return createWeightedECDSAValidator(publicClient, {
    config: { threshold: cfg.threshold, signers: cfg.signers.map(s => ({ address: s.address as Address, weight: s.weight })), delay: cfg.delay },
    signers: signers as never,
    entryPoint: ENTRY_POINT,
    kernelVersion: KERNEL_VERSION,
  });
}

export async function installGuardians(
  rec: AccountRecord,
  guardians: string[],
  threshold: number,
  delaySeconds: number = DEFAULT_RECOVERY_DELAY_SECONDS,
): Promise<string> {
  if (rec.type !== 'smart' || rec.hdIndex == null) throw new Error('Not a smart account.');
  const cfg = weightedConfigFor(guardians, threshold, delaySeconds);

  const owner = await smartOwnerSigner({ hdIndex: rec.hdIndex, phraseId: rec.phraseId });
  const publicClient = makePublicClient();

  const guardianValidator = await buildGuardianValidator(publicClient, cfg);
  const ownerValidator = await signerToEcdsaValidator(publicClient, { signer: owner, entryPoint: ENTRY_POINT, kernelVersion: KERNEL_VERSION });
  const account = await createKernelAccount(publicClient, {
    plugins: { sudo: ownerValidator, regular: guardianValidator, action: getRecoveryAction(ENTRY_POINT.version) },
    entryPoint: ENTRY_POINT,
    kernelVersion: KERNEL_VERSION,
    index: BigInt(rec.hdIndex),
  });
  const kernelClient = makeKernelClient(account, publicClient);

  const hash = await kernelClient.sendUserOperation({
    callData: await account.encodeCalls([{ to: account.address, value: 0n, data: '0x' }]),
  });
  await kernelClient.waitForUserOperationReceipt({ hash });

  await updateSmartAccount(rec.id, {
    deployed: true,
    guardians: cfg.signers.map(s => s.address),
    guardianThreshold: cfg.threshold,
    guardianDelay: cfg.delay,
  });
  return hash;
}

export async function updateGuardians(
  rec: AccountRecord,
  guardians: string[],
  threshold: number,
  delaySeconds: number = DEFAULT_RECOVERY_DELAY_SECONDS,
): Promise<string> {
  if (rec.type !== 'smart' || rec.hdIndex == null) throw new Error('Not a smart account.');
  const cfg = weightedConfigFor(guardians, threshold, delaySeconds);
  const owner = await smartOwnerSigner({ hdIndex: rec.hdIndex, phraseId: rec.phraseId });
  const publicClient = makePublicClient();
  const account = await createEcdsaKernel(publicClient, owner, rec.hdIndex);
  const kernelClient = makeKernelClient(account, publicClient);

  const call = getUpdateConfigCall(ENTRY_POINT, KERNEL_VERSION, {
    threshold: cfg.threshold,
    signers: cfg.signers.map(s => ({ address: s.address as Address, weight: s.weight })),
    delay: cfg.delay,
  });
  const userOpHash = await kernelClient.sendUserOperation({
    callData: await account.encodeCalls([{ to: call.to, value: call.value, data: call.data }]),
  });
  await kernelClient.waitForUserOperationReceipt({ hash: userOpHash });
  await updateSmartAccount(rec.id, {
    guardians: cfg.signers.map(s => s.address),
    guardianThreshold: cfg.threshold,
    guardianDelay: cfg.delay,
  });
  return userOpHash;
}

