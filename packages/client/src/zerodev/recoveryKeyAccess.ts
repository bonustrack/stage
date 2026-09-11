import { concatHex, encodeAbiParameters, encodeFunctionData, type Hex } from 'viem';
import { KERNEL_EXECUTE_SELECTOR, validationIdOf } from './validatorPlan';

export const KERNEL_MODULE_TYPE_VALIDATOR = 1n;
export const KERNEL_NO_HOOK: Hex = '0x0000000000000000000000000000000000000001';

const KERNEL_MODULE_ABI = [
  {
    name: 'installModule', type: 'function', stateMutability: 'payable',
    inputs: [{ name: 'moduleType', type: 'uint256' }, { name: 'module', type: 'address' }, { name: 'initData', type: 'bytes' }],
    outputs: [],
  },
  {
    name: 'uninstallValidation', type: 'function', stateMutability: 'payable',
    inputs: [{ name: 'vId', type: 'bytes21' }, { name: 'deinitData', type: 'bytes' }, { name: 'hookDeinitData', type: 'bytes' }],
    outputs: [],
  },
] as const;

export interface AccountCall { to: Hex; data: Hex; value: bigint }

export function encodeValidatorInstallData(owner: Hex, selector: Hex | null): Hex {
  const packed = encodeAbiParameters(
    [{ type: 'bytes' }, { type: 'bytes' }, { type: 'bytes' }],
    [owner, '0x', selector ?? '0x'],
  );
  return concatHex([KERNEL_NO_HOOK, packed]);
}

export function encodeUninstallValidator(validator: Hex, owner: Hex): Hex {
  return encodeFunctionData({
    abi: KERNEL_MODULE_ABI, functionName: 'uninstallValidation', args: [validationIdOf(validator), owner, '0x'],
  });
}

export function encodeInstallValidator(validator: Hex, owner: Hex, selector: Hex | null): Hex {
  return encodeFunctionData({
    abi: KERNEL_MODULE_ABI, functionName: 'installModule',
    args: [KERNEL_MODULE_TYPE_VALIDATOR, validator, encodeValidatorInstallData(owner, selector)],
  });
}

export function recoveryKeyAccessCalls(account: Hex, validator: Hex, owner: Hex, allow: boolean): AccountCall[] {
  return [
    { to: account, data: encodeUninstallValidator(validator, owner), value: 0n },
    { to: account, data: encodeInstallValidator(validator, owner, allow ? KERNEL_EXECUTE_SELECTOR : null), value: 0n },
  ];
}
