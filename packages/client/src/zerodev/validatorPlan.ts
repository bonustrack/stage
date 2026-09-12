import type { Hex } from 'viem';

export type KernelSigningPlan = 'passkey' | 'ecdsa-root' | 'ecdsa-secondary' | 'unavailable';

export type KernelSigningPurpose = 'sign' | 'transact';

export type PasskeyProblem = 'none' | 'not-stored' | 'mismatch' | 'build-failed';

export interface KernelValidationState {
  rootValidatorId: Hex | null;
  ecdsaInstalled: boolean;
  ecdsaCanExecute: boolean;
}

export const KERNEL_EXECUTE_SELECTOR: Hex = '0xe9ae5c53';

export function validationIdOf(validator: Hex): Hex {
  return `0x01${validator.slice(2).toLowerCase()}`;
}

export function planKernelSigning(
  input: KernelValidationState & { ecdsaValidator: Hex; passkeyUsable: boolean; purpose?: KernelSigningPurpose },
): KernelSigningPlan {
  if (input.passkeyUsable) return 'passkey';
  if (input.rootValidatorId === null) return 'ecdsa-root';
  if (input.rootValidatorId.toLowerCase() === validationIdOf(input.ecdsaValidator)) return 'ecdsa-root';
  const allowed = input.purpose === 'sign' ? input.ecdsaInstalled : input.ecdsaInstalled && input.ecdsaCanExecute;
  return allowed ? 'ecdsa-secondary' : 'unavailable';
}

const PASSKEY_PROBLEMS: Record<PasskeyProblem, string> = {
  none: '',
  'not-stored': 'No passkey is stored on this device.',
  mismatch: 'The passkey stored on this device is not the one this account trusts.',
  'build-failed': 'The passkey on this device could not be prepared.',
};

export function describeUnavailableSigning(purpose: KernelSigningPurpose = 'transact', problem: PasskeyProblem = 'none', detail?: string): string {
  const action = purpose === 'sign' ? 'sign for this account' : 'send transactions for this account';
  const why = PASSKEY_PROBLEMS[problem];
  const extra = detail ? ` (${detail})` : '';
  return `This device cannot ${action}. ${why}${extra} Use the device where the passkey is set up, or link the passkey under Settings > Security.`.replace('.  ', '. ');
}
