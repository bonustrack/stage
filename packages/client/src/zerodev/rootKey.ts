import { encodeFunctionData, zeroAddress, type Hex } from 'viem';
import { planKernelSigning, validationIdOf, type KernelSigningInput } from './validatorPlan';
import { encodeUninstallValidator, type AccountCall } from './recoveryKeyAccess';
import { validatorAddressOf } from './passkeyLink';

const CHANGE_ROOT_VALIDATOR_ABI = [
  {
    name: 'changeRootValidator', type: 'function', stateMutability: 'payable',
    inputs: [
      { name: '_rootValidator', type: 'bytes21' }, { name: 'hook', type: 'address' },
      { name: 'validatorData', type: 'bytes' }, { name: 'hookData', type: 'bytes' },
    ],
    outputs: [],
  },
] as const;

const VALIDATOR_TYPE_PREFIX = '0x01';

export type RootKeyMigration = 'not-needed' | 'passkey' | 'device-passkey' | 'recovery-key' | 'elsewhere';

export function planRootKeyMigration(input: KernelSigningInput & { passkeyRoot: boolean }): RootKeyMigration {
  if (!input.passkeyRoot || input.rootValidatorId === null) return 'not-needed';
  if (input.rootValidatorId.toLowerCase() === validationIdOf(input.ecdsaValidator)) return 'not-needed';
  const plan = planKernelSigning({ ...input, purpose: 'transact' });
  if (plan === 'passkey' || plan === 'device-passkey') return plan;
  return plan === 'ecdsa-secondary' ? 'recovery-key' : 'elsewhere';
}

export function encodeChangeRootToEcdsa(ecdsaValidator: Hex, owner: Hex): Hex {
  return encodeFunctionData({
    abi: CHANGE_ROOT_VALIDATOR_ABI, functionName: 'changeRootValidator', args: [validationIdOf(ecdsaValidator), zeroAddress, owner, '0x'],
  });
}

function retiresOldRoot(oldRootId: Hex, ecdsaValidator: Hex): boolean {
  const id = oldRootId.toLowerCase();
  return id.startsWith(VALIDATOR_TYPE_PREFIX) && id !== validationIdOf(ecdsaValidator);
}

export function rootKeyMigrationCalls(account: Hex, ecdsaValidator: Hex, owner: Hex, oldRootId: Hex): AccountCall[] {
  if (!retiresOldRoot(oldRootId, ecdsaValidator)) throw new Error('The account root is not a passkey validator.');
  return [
    { to: account, data: encodeChangeRootToEcdsa(ecdsaValidator, owner), value: 0n },
    { to: account, data: encodeUninstallValidator(validatorAddressOf(oldRootId), '0x'), value: 0n },
  ];
}
