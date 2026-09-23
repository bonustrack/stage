import type { Hex } from 'viem';

export type KernelSigningPlan = 'passkey' | 'device-passkey' | 'ecdsa-root' | 'ecdsa-secondary' | 'unavailable';

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

type DeployedState = KernelValidationState & { rootValidatorId: Hex; ecdsaValidator: Hex; purpose?: KernelSigningPurpose };

function isEcdsaRoot(input: DeployedState): boolean {
  return input.rootValidatorId.toLowerCase() === validationIdOf(input.ecdsaValidator);
}

function ecdsaPlan(input: DeployedState): Exclude<KernelSigningPlan, 'passkey' | 'device-passkey'> {
  if (isEcdsaRoot(input)) return 'ecdsa-root';
  const allowed = input.purpose === 'sign' ? input.ecdsaInstalled : input.ecdsaInstalled && input.ecdsaCanExecute;
  return allowed ? 'ecdsa-secondary' : 'unavailable';
}

export interface KernelSigningInput extends KernelValidationState {
  ecdsaValidator: Hex;
  passkeyUsable: boolean;
  devicePasskeyUsable?: boolean;
  purpose?: KernelSigningPurpose;
}

export function planKernelSigning(input: KernelSigningInput): KernelSigningPlan {
  const { rootValidatorId } = input;
  if (rootValidatorId === null) return 'ecdsa-root';
  const deployed = { ...input, rootValidatorId };
  const ecdsa = ecdsaPlan(deployed);
  if (input.purpose === 'sign' && ecdsa !== 'unavailable') return ecdsa;
  const device = input.purpose !== 'sign' && input.devicePasskeyUsable === true;
  if (isEcdsaRoot(deployed)) return device ? 'device-passkey' : ecdsa;
  if (input.passkeyUsable) return 'passkey';
  return device ? 'device-passkey' : ecdsa;
}

const PASSKEY_PROBLEMS: Record<PasskeyProblem, string> = {
  none: '',
  'not-stored': 'No passkey is stored on this device.',
  mismatch: 'The passkey stored on this device is not the one this account trusts.',
  'build-failed': 'The passkey on this device could not be prepared.',
};

const TRANSACT_NEXT_STEPS =
  'Approve with your passkey, or on the device that has it open Settings > Security and make your recovery phrase the main key.';

const SIGN_NEXT_STEPS = 'Use the device where the passkey is set up, or link the passkey under Settings > Security.';

export function describeUnavailableSigning(purpose: KernelSigningPurpose = 'transact', problem: PasskeyProblem = 'none', detail?: string): string {
  const action = purpose === 'sign' ? 'sign for this account' : 'send transactions for this account';
  const why = PASSKEY_PROBLEMS[problem];
  const extra = detail ? ` (${detail})` : '';
  const next = purpose === 'sign' ? SIGN_NEXT_STEPS : TRANSACT_NEXT_STEPS;
  return `This device cannot ${action}. ${why}${extra} ${next}`.replace('.  ', '. ');
}
