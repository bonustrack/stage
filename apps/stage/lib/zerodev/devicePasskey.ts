import '../cryptoShim';
import { concat, zeroAddress, type Hex, type PublicClient } from 'viem';
import { createKernelAccount, type CreateKernelAccountReturnType, type KernelValidator } from '@zerodev/sdk';
import { KERNEL_EXECUTE_SELECTOR } from '@stage-labs/client/zerodev/validatorPlan';
import { ENTRY_POINT, KERNEL_VERSION } from '@stage-labs/client/zerodev/account';
import {
  PERMISSION_CONFIG_ABI, devicePasskeyEnableData, devicePasskeyPermissionId, isDevicePasskeyInstalled, permissionValidationId,
  type DevicePasskeyKey,
} from '@stage-labs/client/zerodev/devicePasskey';
import type { AccountRecord } from '../accounts';
import { ecdsaValidatorForOwner, passkeyValidatorFromStored } from './account';
import { smartOwnerSigner } from './keyring';
import type { StoredPasskey } from './passkeys.model';

const PERMISSION_SIGNATURE_PREFIX: Hex = '0xff';

const KERNEL_PERMISSION_ABI = [
  ...PERMISSION_CONFIG_ABI,
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

export type DevicePasskeyRecord = NonNullable<AccountRecord['devicePasskey']>;

export function devicePasskeyKey(stored: Pick<StoredPasskey, 'pubX' | 'pubY' | 'authenticatorIdHash'>): DevicePasskeyKey {
  return { pubX: stored.pubX as Hex, pubY: stored.pubY as Hex, authenticatorIdHash: stored.authenticatorIdHash as Hex };
}

export async function readDevicePasskeyInstalled(publicClient: PublicClient, account: Hex, permissionId: Hex): Promise<boolean> {
  const code = await publicClient.getCode({ address: account });
  if (!code || code === '0x') return false;
  const kernel = { address: account, abi: KERNEL_PERMISSION_ABI } as const;
  const vId = permissionValidationId(permissionId);
  const [[, hook], config, canExecute] = await Promise.all([
    publicClient.readContract({ ...kernel, functionName: 'validationConfig', args: [vId] }),
    publicClient.readContract({ ...kernel, functionName: 'permissionConfig', args: [permissionId] }),
    publicClient.readContract({ ...kernel, functionName: 'isAllowedSelector', args: [vId, KERNEL_EXECUTE_SELECTOR] }),
  ]);
  return isDevicePasskeyInstalled({ hook, signer: config.signer, canExecute });
}

async function signingPasskey(publicClient: PublicClient, stored: StoredPasskey): Promise<KernelValidator> {
  const validator = await passkeyValidatorFromStored(publicClient, stored);
  if (!validator) throw new Error('Passkeys are not available on this device.');
  return validator;
}

export async function devicePasskeyValidator(publicClient: PublicClient, stored: StoredPasskey): Promise<KernelValidator> {
  const passkey = await signingPasskey(publicClient, stored);
  const key = devicePasskeyKey(stored);
  const permissionId = devicePasskeyPermissionId(key);
  return {
    ...passkey,
    supportedKernelVersions: '>=0.3.0',
    validatorType: 'PERMISSION',
    address: zeroAddress,
    source: 'PermissionValidator',
    getIdentifier: () => permissionId,
    getEnableData: () => Promise.resolve(devicePasskeyEnableData(key)),
    signMessage: async (args) => concat([PERMISSION_SIGNATURE_PREFIX, await passkey.signMessage(args)]),
    signTypedData: async (typedData) => concat([PERMISSION_SIGNATURE_PREFIX, await passkey.signTypedData(typedData)]),
    signUserOperation: async (userOperation) => concat([PERMISSION_SIGNATURE_PREFIX, await passkey.signUserOperation(userOperation)]),
    getStubSignature: async (userOperation) => concat([PERMISSION_SIGNATURE_PREFIX, await passkey.getStubSignature(userOperation)]),
    getNonceKey: (_account, customNonceKey) => Promise.resolve(customNonceKey ?? 0n),
    isEnabled: (account) => readDevicePasskeyInstalled(publicClient, account, permissionId),
  };
}

export async function devicePasskeyKernel(publicClient: PublicClient, address: Hex, stored: StoredPasskey): Promise<CreateKernelAccountReturnType> {
  const regular = await devicePasskeyValidator(publicClient, stored);
  return createKernelAccount(publicClient, { plugins: { regular }, entryPoint: ENTRY_POINT, kernelVersion: KERNEL_VERSION, address });
}

export interface EnablingAccount { address: Hex; hdIndex: number; phraseId?: string }

export async function enablingDevicePasskeyKernel(
  publicClient: PublicClient, account: EnablingAccount, stored: StoredPasskey,
): Promise<CreateKernelAccountReturnType> {
  const owner = await smartOwnerSigner({ hdIndex: account.hdIndex, phraseId: account.phraseId });
  const [sudo, regular] = await Promise.all([ecdsaValidatorForOwner(publicClient, owner), devicePasskeyValidator(publicClient, stored)]);
  return createKernelAccount(publicClient, {
    plugins: { sudo, regular }, entryPoint: ENTRY_POINT, kernelVersion: KERNEL_VERSION,
    index: BigInt(account.hdIndex), address: account.address,
  });
}

export async function devicePasskeyUsable(publicClient: PublicClient, rec: AccountRecord): Promise<boolean> {
  const stored = rec.devicePasskey;
  if (!stored) return false;
  return readDevicePasskeyInstalled(publicClient, rec.address as Hex, devicePasskeyPermissionId(devicePasskeyKey(stored)));
}
