import '../cryptoShim';
import type { Hex } from 'viem';
import { getValidatorAddress } from '@zerodev/ecdsa-validator';
import { KERNEL_EXECUTE_SELECTOR, validationIdOf } from '@stage-labs/client/zerodev/validatorPlan';
import { recoveryKeyAccessCalls } from '@stage-labs/client/zerodev/recoveryKeyAccess';
import type { AccountRecord } from '../accounts';
import { makePublicClient } from './client';
import { ENTRY_POINT, KERNEL_VERSION } from './config';
import { kernelClientForRecord } from './kernelForRecord';
import { smartOwnerAddress } from './keyring';

const ALLOWED_SELECTOR_ABI = [
  {
    name: 'isAllowedSelector', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'vId', type: 'bytes21' }, { name: 'selector', type: 'bytes4' }],
    outputs: [{ type: 'bool' }],
  },
] as const;

export type RecoveryKeyAccessResult = { ok: true; txHash: string } | { ok: false; message: string };

function ecdsaValidatorAddress(): Hex {
  return getValidatorAddress(ENTRY_POINT, KERNEL_VERSION);
}

export async function recoveryKeyCanExecute(rec: AccountRecord): Promise<boolean | null> {
  if (rec.type !== 'smart') return null;
  try {
    const publicClient = makePublicClient();
    const code = await publicClient.getCode({ address: rec.address as Hex });
    if (!code || code === '0x') return null;
    return await publicClient.readContract({
      address: rec.address as Hex, abi: ALLOWED_SELECTOR_ABI, functionName: 'isAllowedSelector',
      args: [validationIdOf(ecdsaValidatorAddress()), KERNEL_EXECUTE_SELECTOR],
    });
  } catch {
    return null;
  }
}

export async function setRecoveryKeyAccess(rec: AccountRecord, allow: boolean): Promise<RecoveryKeyAccessResult> {
  if (rec.type !== 'smart' || rec.hdIndex == null) return { ok: false, message: 'Not a smart account.' };
  if (!rec.passkey) return { ok: false, message: 'Only the device holding the passkey can change this.' };
  try {
    const owner = (await smartOwnerAddress(rec.hdIndex)) as Hex;
    const kernel = await kernelClientForRecord(rec);
    const calls = recoveryKeyAccessCalls(rec.address as Hex, ecdsaValidatorAddress(), owner, allow);
    const txHash = await kernel.sendTransaction({ calls });
    return { ok: true, txHash };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message.split('\n')[0] ?? 'Transaction failed' : String(e) };
  }
}
