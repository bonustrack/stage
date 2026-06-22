
import type { PublicClient } from 'viem';
import type { HDAccount } from 'viem/accounts';
import { getEntryPoint, KERNEL_V3_1 } from '@zerodev/sdk/constants';
import { createKernelAccount, type CreateKernelAccountReturnType } from '@zerodev/sdk';
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import { ENTRY_POINT_VERSION } from './config';

export const ENTRY_POINT = getEntryPoint(ENTRY_POINT_VERSION);

export const KERNEL_VERSION = KERNEL_V3_1;

export async function ecdsaValidatorForOwner(
  publicClient: PublicClient,
  owner: HDAccount,
): Promise<Awaited<ReturnType<typeof signerToEcdsaValidator>>> {
  return signerToEcdsaValidator(publicClient, {
    signer: owner,
    entryPoint: ENTRY_POINT,
    kernelVersion: KERNEL_VERSION,
  });
}

export async function createEcdsaKernel(
  publicClient: PublicClient,
  owner: HDAccount,
  hdIndex: number,
): Promise<CreateKernelAccountReturnType> {
  const ecdsaValidator = await ecdsaValidatorForOwner(publicClient, owner);
  return createKernelAccount(publicClient, {
    plugins: { sudo: ecdsaValidator },
    entryPoint: ENTRY_POINT,
    kernelVersion: KERNEL_VERSION,
    index: BigInt(hdIndex),
  });
}
