import { describe, expect, test } from 'bun:test';
import { planKernelSigning, validationIdOf } from '../src/zerodev/validatorPlan';

const ECDSA = '0x845ADb2C711129d4f3966735eD98a9F09fC4cE57';
const PASSKEY_ROOT = '0x017ab16ff354acb328452f1d445b3ddee9a91e9e69';

describe('planKernelSigning', () => {
  test('prefers the passkey whenever this device can use it', () => {
    expect(planKernelSigning({ rootValidatorId: PASSKEY_ROOT, ecdsaInstalled: true, ecdsaCanExecute: false, ecdsaValidator: ECDSA, passkeyUsable: true })).toBe('passkey');
  });

  test('signs as root with the ECDSA key for undeployed or ECDSA-rooted accounts', () => {
    expect(planKernelSigning({ rootValidatorId: null, ecdsaInstalled: false, ecdsaCanExecute: false, ecdsaValidator: ECDSA, passkeyUsable: false })).toBe('ecdsa-root');
    expect(planKernelSigning({ rootValidatorId: validationIdOf(ECDSA), ecdsaInstalled: true, ecdsaCanExecute: false, ecdsaValidator: ECDSA, passkeyUsable: false })).toBe('ecdsa-root');
  });

  test('uses the ECDSA key as a secondary validator only when the account lets it execute', () => {
    expect(planKernelSigning({ rootValidatorId: PASSKEY_ROOT, ecdsaInstalled: true, ecdsaCanExecute: true, ecdsaValidator: ECDSA, passkeyUsable: false })).toBe('ecdsa-secondary');
    expect(planKernelSigning({ rootValidatorId: PASSKEY_ROOT, ecdsaInstalled: true, ecdsaCanExecute: false, ecdsaValidator: ECDSA, passkeyUsable: false })).toBe('unavailable');
    expect(planKernelSigning({ rootValidatorId: PASSKEY_ROOT, ecdsaInstalled: false, ecdsaCanExecute: false, ecdsaValidator: ECDSA, passkeyUsable: false })).toBe('unavailable');
  });

  test('message signing only needs the ECDSA validator to be installed', () => {
    expect(planKernelSigning({ rootValidatorId: PASSKEY_ROOT, ecdsaInstalled: true, ecdsaCanExecute: false, ecdsaValidator: ECDSA, passkeyUsable: false, purpose: 'sign' })).toBe('ecdsa-secondary');
    expect(planKernelSigning({ rootValidatorId: PASSKEY_ROOT, ecdsaInstalled: true, ecdsaCanExecute: false, ecdsaValidator: ECDSA, passkeyUsable: false, purpose: 'transact' })).toBe('unavailable');
  });

  test('validation ids are the secondary-type prefix plus the lowercase address', () => {
    expect(validationIdOf(ECDSA)).toBe('0x01845adb2c711129d4f3966735ed98a9f09fc4ce57');
  });
});
