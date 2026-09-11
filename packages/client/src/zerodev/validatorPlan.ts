import type { Hex } from 'viem';

export type KernelSigningPlan = 'passkey' | 'ecdsa-root' | 'ecdsa-secondary' | 'unavailable';

export interface KernelValidationState {
  rootValidatorId: Hex | null;
  ecdsaInstalled: boolean;
}

export function validationIdOf(validator: Hex): Hex {
  return `0x01${validator.slice(2).toLowerCase()}`;
}

export function planKernelSigning(input: KernelValidationState & { ecdsaValidator: Hex; passkeyUsable: boolean }): KernelSigningPlan {
  if (input.passkeyUsable) return 'passkey';
  if (input.rootValidatorId === null) return 'ecdsa-root';
  if (input.rootValidatorId.toLowerCase() === validationIdOf(input.ecdsaValidator)) return 'ecdsa-root';
  if (input.ecdsaInstalled) return 'ecdsa-secondary';
  return 'unavailable';
}

export function describeUnavailableSigning(): string {
  return 'This device cannot sign for this account: its passkey is not available here and the recovery key is not enabled on the account.';
}
