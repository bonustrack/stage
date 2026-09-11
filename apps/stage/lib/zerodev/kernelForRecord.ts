import '../cryptoShim';
import type { Hex, PublicClient } from 'viem';
import { createKernelAccount, type CreateKernelAccountReturnType, type KernelAccountClient } from '@zerodev/sdk';
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

async function passkeyKernelFor(publicClient: PublicClient, rec: AccountRecord, hdIndex: number): Promise<CreateKernelAccountReturnType | null> {
  if (!rec.passkey) return null;
  const addressOverride = rec.passkeySudo ? undefined : (rec.address as Hex);
  return passkeyKernelFromStored(
    publicClient,
    undefined as unknown as Parameters<typeof passkeyKernelFromStored>[1],
    hdIndex,
    rec.passkey,
    addressOverride,
  );
}

export async function kernelClientForRecord(rec: AccountRecord): Promise<KernelAccountClient> {
  if (rec.type !== 'smart' || rec.hdIndex == null) {
    throw new Error('Not a smart account.');
  }
  const publicClient = makePublicClient();
  const owner = await smartOwnerSigner(rec.hdIndex);
  const ecdsaValidator = await ecdsaValidatorForOwner(publicClient, owner);
  const passkeyAccount = await passkeyKernelFor(publicClient, rec, rec.hdIndex);
  const state = await readValidationState(publicClient, rec.address as Hex, ecdsaValidator.address);
  const plan = planKernelSigning({ ...state, ecdsaValidator: ecdsaValidator.address, passkeyUsable: passkeyAccount !== null });

  if (plan === 'passkey' && passkeyAccount) return makeKernelClient(passkeyAccount, publicClient);
  if (plan === 'ecdsa-root') {
    return makeKernelClient(await createEcdsaKernel(publicClient, owner, rec.hdIndex), publicClient);
  }
  if (plan === 'ecdsa-secondary') {
    const account = await createKernelAccount(publicClient, {
      plugins: { regular: ecdsaValidator },
      entryPoint: ENTRY_POINT,
      kernelVersion: KERNEL_VERSION,
      address: rec.address as Hex,
    });
    return makeKernelClient(account, publicClient);
  }
  throw new Error(describeUnavailableSigning());
}
