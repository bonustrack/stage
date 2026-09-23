import '../cryptoShim';
import type { Hex, PublicClient } from 'viem';
import type { HDAccount } from 'viem/accounts';
import { createKernelAccount, type CreateKernelAccountReturnType, type KernelAccountClient } from '@zerodev/sdk';
import { getValidatorAddress } from '@zerodev/ecdsa-validator';
import {
  KERNEL_EXECUTE_SELECTOR, describeUnavailableSigning, planKernelSigning, validationIdOf,
  type KernelSigningInput, type KernelSigningPurpose, type KernelValidationState, type PasskeyProblem,
} from '@stage-labs/client/zerodev/validatorPlan';
import type { AccountRecord } from '../accounts';
import { smartOwnerSigner } from './keyring';
import { makePublicClient, makeKernelClient } from './client';
import { createEcdsaKernel, ecdsaValidatorForOwner, passkeyKernelResult } from './account';
import { ENTRY_POINT, KERNEL_VERSION } from '@stage-labs/client/zerodev/account';
import { accountPasskey, storedPasskeyMatches } from './linkPasskey';
import { devicePasskeyKernel, devicePasskeyUsable } from './devicePasskey';
import { passkeysAvailable } from './passkeys';
import { recover, ignored } from '../errorPolicy';

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
    publicClient.readContract({ ...kernel, functionName: 'isAllowedSelector', args: [ecdsaId, KERNEL_EXECUTE_SELECTOR] }).catch(ignored(false, 'probe')),
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

interface PasskeyAttempt { account: CreateKernelAccountReturnType | null; problem: PasskeyProblem; detail?: string }

async function passkeyProblem(rec: AccountRecord): Promise<PasskeyProblem> {
  if (!rec.passkey) return 'not-stored';
  const onchain = await accountPasskey(rec.address as Hex).catch(recover('passkey.onchain', null));
  return storedPasskeyMatches(rec, onchain) ? 'none' : 'mismatch';
}

async function tryPasskey(publicClient: PublicClient, rec: AccountRecord, hdIndex: number): Promise<PasskeyAttempt> {
  if (!rec.passkey) return { account: null, problem: 'not-stored' };
  const addressOverride = rec.passkeySudo ? undefined : (rec.address as Hex);
  const result = await passkeyKernelResult(publicClient, hdIndex, rec.passkey, addressOverride);
  if ('account' in result) return { account: result.account, problem: 'none' };
  return { account: null, problem: 'build-failed', detail: result.error };
}

async function deviceKernelClient(publicClient: PublicClient, rec: AccountRecord): Promise<KernelAccountClient | null> {
  if (!rec.devicePasskey) return null;
  const account = await devicePasskeyKernel(publicClient, rec.address as Hex, rec.devicePasskey).catch(recover('passkey.device', null));
  return account ? makeKernelClient(account, publicClient) : null;
}

async function deviceUsable(publicClient: PublicClient, rec: AccountRecord, purpose: KernelSigningPurpose): Promise<boolean> {
  if (purpose === 'sign' || !rec.devicePasskey || !passkeysAvailable()) return false;
  return devicePasskeyUsable(publicClient, rec).catch(recover('passkey.device', false));
}

export async function ecdsaRootClient(rec: AccountRecord & { hdIndex: number }): Promise<KernelAccountClient> {
  const publicClient = makePublicClient();
  const owner = await smartOwnerSigner({ hdIndex: rec.hdIndex, phraseId: rec.phraseId });
  return makeKernelClient(await createEcdsaKernel(publicClient, owner, rec.hdIndex, rec.address as Hex), publicClient);
}

async function ecdsaClient(publicClient: PublicClient, rec: AccountRecord & { hdIndex: number }, plan: 'ecdsa-root' | 'ecdsa-secondary'): Promise<KernelAccountClient> {
  if (plan === 'ecdsa-root') return ecdsaRootClient(rec);
  const owner = await smartOwnerSigner({ hdIndex: rec.hdIndex, phraseId: rec.phraseId });
  return secondaryEcdsaClient(publicClient, owner, rec.address as Hex);
}

export interface SigningContext {
  publicClient: PublicClient;
  input: KernelSigningInput;
  problem: PasskeyProblem;
}

export async function signingContext(rec: AccountRecord, purpose: KernelSigningPurpose = 'transact'): Promise<SigningContext> {
  const publicClient = makePublicClient();
  const ecdsaValidator = getValidatorAddress(ENTRY_POINT, KERNEL_VERSION);
  const [state, problem, devicePasskeyUsable] = await Promise.all([
    readValidationState(publicClient, rec.address as Hex, ecdsaValidator), passkeyProblem(rec), deviceUsable(publicClient, rec, purpose),
  ]);
  return { publicClient, problem, input: { ...state, ecdsaValidator, passkeyUsable: problem === 'none', devicePasskeyUsable, purpose } };
}

function smartRecord(rec: AccountRecord): AccountRecord & { hdIndex: number } {
  if (rec.type !== 'smart' || rec.hdIndex == null) throw new Error('Not a smart account.');
  return { ...rec, hdIndex: rec.hdIndex };
}

export async function kernelClientForRecord(rec: AccountRecord, purpose: KernelSigningPurpose = 'transact'): Promise<KernelAccountClient> {
  const smart = smartRecord(rec);
  const { publicClient, input, problem } = await signingContext(rec, purpose);
  const planFor = (passkeyUsable: boolean, devicePasskeyUsable: boolean): ReturnType<typeof planKernelSigning> =>
    planKernelSigning({ ...input, passkeyUsable, devicePasskeyUsable });
  let passkey: PasskeyAttempt = { account: null, problem };
  let plan = planKernelSigning(input);
  if (plan === 'passkey') {
    passkey = await tryPasskey(publicClient, rec, smart.hdIndex);
    if (passkey.account) return makeKernelClient(passkey.account, publicClient);
    plan = planFor(false, input.devicePasskeyUsable === true);
  }
  if (plan === 'device-passkey') {
    const client = await deviceKernelClient(publicClient, rec);
    if (client) return client;
    plan = planFor(false, false);
  }
  if (plan !== 'ecdsa-root' && plan !== 'ecdsa-secondary') {
    throw new Error(describeUnavailableSigning(purpose, passkey.problem, passkey.detail));
  }
  return ecdsaClient(publicClient, smart, plan);
}
