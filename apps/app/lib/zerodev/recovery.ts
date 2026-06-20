
import '../cryptoShim';
import { encodeFunctionData, keccak256, encodeAbiParameters, parseAbiParameters, type Address, type Hex, type PublicClient } from 'viem';
import type { HDAccount } from 'viem/accounts';
import { createKernelAccount } from '@zerodev/sdk';
import { createWeightedECDSAValidator, getRecoveryAction, getUpdateConfigCall } from '@zerodev/weighted-ecdsa-validator';
import { getValidatorAddress as getEcdsaValidatorAddress, signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import { getValidatorAddress as getWeightedValidatorAddress } from '@zerodev/weighted-ecdsa-validator';
import { ENTRY_POINT, KERNEL_VERSION } from './config';
import {
  weightedConfigFor, type WeightedConfig, DEFAULT_RECOVERY_DELAY_SECONDS,
} from '@stage-labs/client/zerodev/recovery';
import type { AccountRecord } from '../accounts';
import { updateSmartAccount } from '../accounts';
import { smartOwnerSigner } from './keyring';
import { makePublicClient, makeKernelClient } from './client';
import { createEcdsaKernel } from './account';

const DO_RECOVERY_ABI = [{
  type: 'function',
  name: 'doRecovery',
  stateMutability: 'nonpayable',
  inputs: [
    { name: '_validator', type: 'address' },
    { name: '_data', type: 'bytes' },
  ],
  outputs: [],
}] as const;

const WEIGHTED_ABI = [
  { type: 'function', name: 'veto', stateMutability: 'nonpayable', inputs: [{ name: '_callDataAndNonceHash', type: 'bytes32' }], outputs: [] },
  { type: 'function', name: 'proposalStatus', stateMutability: 'view', inputs: [{ name: 'callDataAndNonceHash', type: 'bytes32' }, { name: 'kernel', type: 'address' }], outputs: [{ name: 'status', type: 'uint8' }, { name: 'validAfter', type: 'uint48' }] },
] as const;

export function recoveryCallData(newOwner: Address): Hex {
  return encodeFunctionData({
    abi: DO_RECOVERY_ABI,
    functionName: 'doRecovery',
    args: [getEcdsaValidatorAddress(ENTRY_POINT, KERNEL_VERSION), newOwner],
  });
}

export function callDataAndNonceHash(sender: Address, callData: Hex, nonce: bigint): Hex {
  return keccak256(encodeAbiParameters(parseAbiParameters('address, bytes, uint256'), [sender, callData, nonce]));
}

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

  const owner = await smartOwnerSigner(rec.hdIndex);
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

export async function signRecoveryApproval(
  guardianSigner: HDAccount,
  wallet: Address,
  newOwner: Address,
  nonce: bigint,
): Promise<Hex> {
  const callData = recoveryCallData(newOwner);
  const hash = callDataAndNonceHash(wallet, callData, nonce);
  const validatorAddress = getWeightedValidatorAddress(ENTRY_POINT, KERNEL_VERSION);
  return guardianSigner.signTypedData({
    domain: { name: 'WeightedECDSAValidator', version: '0.0.3', chainId: 8453, verifyingContract: validatorAddress },
    types: { Approve: [{ name: 'callDataAndNonceHash', type: 'bytes32' }] },
    primaryType: 'Approve',
    message: { callDataAndNonceHash: hash },
  });
}

export async function cancelRecovery(rec: AccountRecord, newOwner: Address, nonce: bigint): Promise<string> {
  if (rec.type !== 'smart' || rec.hdIndex == null) throw new Error('Not a smart account.');
  const owner = await smartOwnerSigner(rec.hdIndex);
  const publicClient = makePublicClient();
  const account = await createEcdsaKernel(publicClient, owner, rec.hdIndex);
  const kernelClient = makeKernelClient(account, publicClient);

  const callData = recoveryCallData(newOwner);
  const hash = callDataAndNonceHash(account.address, callData, nonce);
  const validatorAddress = getWeightedValidatorAddress(ENTRY_POINT, KERNEL_VERSION);
  const userOpHash = await kernelClient.sendUserOperation({
    callData: await account.encodeCalls([{
      to: validatorAddress, value: 0n,
      data: encodeFunctionData({ abi: WEIGHTED_ABI, functionName: 'veto', args: [hash] }),
    }]),
  });
  await kernelClient.waitForUserOperationReceipt({ hash: userOpHash });
  return userOpHash;
}

export async function updateGuardians(
  rec: AccountRecord,
  guardians: string[],
  threshold: number,
  delaySeconds: number = DEFAULT_RECOVERY_DELAY_SECONDS,
): Promise<string> {
  if (rec.type !== 'smart' || rec.hdIndex == null) throw new Error('Not a smart account.');
  const cfg = weightedConfigFor(guardians, threshold, delaySeconds);
  const owner = await smartOwnerSigner(rec.hdIndex);
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

