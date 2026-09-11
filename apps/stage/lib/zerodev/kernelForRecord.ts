import '../cryptoShim';
import type { Hex, PublicClient } from 'viem';
import type { HDAccount } from 'viem/accounts';
import { createKernelAccount, type CreateKernelAccountReturnType, type KernelAccountClient } from '@zerodev/sdk';
import { getValidatorAddress } from '@zerodev/ecdsa-validator';
import {
  KERNEL_EXECUTE_SELECTOR, describeUnavailableSigning, planKernelSigning, validationIdOf, type KernelValidationState,
} from '@stage-labs/client/zerodev/validatorPlan';
import type { AccountRecord } from '../accounts';
import { smartOwnerSigner } from './keyring';
import { makePublicClient, makeKernelClient } from './client';
import { createEcdsaKernel, ecdsaValidatorForOwner, passkeyKernelFromStored } from './account';
import { ENTRY_POINT, KERNEL_VERSION } from './config';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const KERNEL_VALIDATION_ABI = [
  { name: 'rootValidator', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes21' }] },
  {
    name: 'validationConfig', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'vId', type: 'bytes21' }],
    outputs: [{ name: 'nonce', type: 'uint32' }, { name: 'hook', type: 'address' }],
  },
  {
    name: 'isAllowedSelector', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'vId', type: 'bytes21' }, { name: 'selector', type: 'bytes4' }],
    outputs: [{ type: 'bool' }],
  },
] as const;

async function readValidationState(publicClient: PublicClient, account: Hex, ecdsaValidator: Hex): Promise<KernelValidationState> {
  const code = await publicClient.getCode({ address: account });
  if (!code || code === '0x') return { rootValidatorId: null, ecdsaInstalled: false, ecdsaCanExecute: false };
  const kernel = { address: account, abi: KERNEL_VALIDATION_ABI } as const;
  const ecdsaId = validationIdOf(ecdsaValidator);
  const [rootValidatorId, [, hook], ecdsaCanExecute] = await Promise.all([
    publicClient.readContract({ ...kernel, functionName: 'rootValidator' }),
    publicClient.readContract({ ...kernel, functionName: 'validationConfig', args: [ecdsaId] }),
    publicClient.readContract({ ...kernel, functionName: 'isAllowedSelector', args: [ecdsaId, KERNEL_EXECUTE_SELECTOR] }).catch(() => false),
  ]);
  return { rootValidatorId, ecdsaInstalled: hook.toLowerCase() !== ZERO_ADDRESS, ecdsaCanExecute };
}

async function secondaryEcdsaClient(publicClient: PublicClient, owner: HDAccount, address: Hex): Promise<KernelAccountClient> {
  const ecdsaValidator = await ecdsaValidatorForOwner(publicClient, owner);
  const account = await createKernelAccount(publicClient, {
    plugins: { regular: ecdsaValidator },
    entryPoint: ENTRY_POINT,
    kernelVersion: KERNEL_VERSION,
    address,
  });
  return makeKernelClient(account, publicClient);
}

export async function kernelClientForRecord(rec: AccountRecord): Promise<KernelAccountClient> {
  if (rec.type !== 'smart' || rec.hdIndex == null) {
    throw new Error('Not a smart account.');
  }
  const publicClient = makePublicClient();
  const hdIndex = rec.hdIndex;
  let passkeyAccount: CreateKernelAccountReturnType | null = null;
  if (rec.passkey) {
    const addressOverride = rec.passkeySudo ? undefined : (rec.address as Hex);
    passkeyAccount = await passkeyKernelFromStored(
      publicClient,
      undefined as unknown as Parameters<typeof passkeyKernelFromStored>[1],
      hdIndex,
      rec.passkey,
      addressOverride,
    );
  }
  if (passkeyAccount) return makeKernelClient(passkeyAccount, publicClient);

  const ecdsaValidator = getValidatorAddress(ENTRY_POINT, KERNEL_VERSION);
  const state = await readValidationState(publicClient, rec.address as Hex, ecdsaValidator);
  const plan = planKernelSigning({ ...state, ecdsaValidator, passkeyUsable: false });
  if (plan !== 'ecdsa-root' && plan !== 'ecdsa-secondary') throw new Error(describeUnavailableSigning());

  const owner = await smartOwnerSigner(hdIndex);
  if (plan === 'ecdsa-root') {
    return makeKernelClient(await createEcdsaKernel(publicClient, owner, hdIndex), publicClient);
  }
  return secondaryEcdsaClient(publicClient, owner, rec.address as Hex);
}
