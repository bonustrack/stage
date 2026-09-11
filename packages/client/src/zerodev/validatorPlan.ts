import type { Hex } from 'viem';

export type KernelSigningPlan = 'passkey' | 'ecdsa-root' | 'ecdsa-secondary' | 'unavailable';

export interface KernelValidationState {
  rootValidatorId: Hex | null;
  ecdsaInstalled: boolean;
  ecdsaCanExecute: boolean;
}

export const KERNEL_EXECUTE_SELECTOR: Hex = '0xe9ae5c53';

export function validationIdOf(validator: Hex): Hex {
  return `0x01${validator.slice(2).toLowerCase()}`;
}

export function planKernelSigning(input: KernelValidationState & { ecdsaValidator: Hex; passkeyUsable: boolean }): KernelSigningPlan {
  if (input.passkeyUsable) return 'passkey';
  if (input.rootValidatorId === null) return 'ecdsa-root';
  if (input.rootValidatorId.toLowerCase() === validationIdOf(input.ecdsaValidator)) return 'ecdsa-root';
  if (input.ecdsaInstalled && input.ecdsaCanExecute) return 'ecdsa-secondary';
  return 'unavailable';
}

export function describeUnavailableSigning(): string {
  return 'This device cannot send transactions for this account. Its passkey is the only key allowed to transact, so use the device where the passkey is set up.';
}
