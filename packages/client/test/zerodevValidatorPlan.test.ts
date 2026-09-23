import { describe, expect, test } from 'bun:test';
import { describeUnavailableSigning, planKernelSigning, validationIdOf } from '../src/zerodev/validatorPlan';

const ECDSA = '0x845ADb2C711129d4f3966735eD98a9F09fC4cE57';
const PASSKEY_ROOT = '0x017ab16ff354acb328452f1d445b3ddee9a91e9e69';

describe('planKernelSigning', () => {
  test('transactions prefer the passkey whenever this device can use it', () => {
    expect(planKernelSigning({ rootValidatorId: PASSKEY_ROOT, ecdsaInstalled: true, ecdsaCanExecute: false, ecdsaValidator: ECDSA, passkeyUsable: true })).toBe('passkey');
    expect(planKernelSigning({ rootValidatorId: PASSKEY_ROOT, ecdsaInstalled: true, ecdsaCanExecute: true, ecdsaValidator: ECDSA, passkeyUsable: true, purpose: 'transact' })).toBe('passkey');
  });

  test('message signing uses the silent ECDSA key and keeps the passkey for when it is the only signer', () => {
    expect(planKernelSigning({ rootValidatorId: PASSKEY_ROOT, ecdsaInstalled: true, ecdsaCanExecute: false, ecdsaValidator: ECDSA, passkeyUsable: true, purpose: 'sign' })).toBe('ecdsa-secondary');
    expect(planKernelSigning({ rootValidatorId: validationIdOf(ECDSA), ecdsaInstalled: true, ecdsaCanExecute: false, ecdsaValidator: ECDSA, passkeyUsable: true, purpose: 'sign' })).toBe('ecdsa-root');
    expect(planKernelSigning({ rootValidatorId: PASSKEY_ROOT, ecdsaInstalled: false, ecdsaCanExecute: false, ecdsaValidator: ECDSA, passkeyUsable: true, purpose: 'sign' })).toBe('passkey');
  });

  test('a stale passkey never takes over transactions on an ECDSA-rooted or undeployed account', () => {
    expect(planKernelSigning({ rootValidatorId: validationIdOf(ECDSA), ecdsaInstalled: true, ecdsaCanExecute: false, ecdsaValidator: ECDSA, passkeyUsable: true, purpose: 'transact' })).toBe('ecdsa-root');
    expect(planKernelSigning({ rootValidatorId: null, ecdsaInstalled: false, ecdsaCanExecute: false, ecdsaValidator: ECDSA, passkeyUsable: true, purpose: 'transact' })).toBe('ecdsa-root');
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

  test('this device\'s own passkey transacts when the account passkey is elsewhere', () => {
    const base = { rootValidatorId: PASSKEY_ROOT, ecdsaInstalled: true, ecdsaCanExecute: false, ecdsaValidator: ECDSA, passkeyUsable: false } as const;
    expect(planKernelSigning({ ...base, devicePasskeyUsable: true })).toBe('device-passkey');
    expect(planKernelSigning({ ...base, ecdsaCanExecute: true, devicePasskeyUsable: true })).toBe('device-passkey');
    expect(planKernelSigning({ ...base, passkeyUsable: true, devicePasskeyUsable: true })).toBe('passkey');
    expect(planKernelSigning({ ...base, devicePasskeyUsable: false })).toBe('unavailable');
    expect(planKernelSigning({ ...base })).toBe('unavailable');
  });

  test('this device\'s passkey never signs messages', () => {
    const base = { ecdsaInstalled: true, ecdsaCanExecute: false, ecdsaValidator: ECDSA, passkeyUsable: false, devicePasskeyUsable: true } as const;
    expect(planKernelSigning({ ...base, rootValidatorId: PASSKEY_ROOT, purpose: 'sign' })).toBe('ecdsa-secondary');
    expect(planKernelSigning({ ...base, rootValidatorId: PASSKEY_ROOT, ecdsaInstalled: false, purpose: 'sign' })).toBe('unavailable');
    expect(planKernelSigning({ ...base, rootValidatorId: validationIdOf(ECDSA), purpose: 'sign' })).toBe('ecdsa-root');
  });

  test('the transaction message points to the passkey device and the migration', () => {
    const text = describeUnavailableSigning('transact', 'not-stored');
    expect(text).toContain('No passkey is stored on this device.');
    expect(text).toContain('make your recovery phrase the main key');
    expect(describeUnavailableSigning('sign')).toContain('link the passkey');
    expect(text.includes(String.fromCharCode(0x2014))).toBe(false);
  });

  test('the four account states pick the right signer', () => {
    const ecdsaRoot = { rootValidatorId: validationIdOf(ECDSA), ecdsaInstalled: true, ecdsaCanExecute: false, ecdsaValidator: ECDSA, passkeyUsable: false } as const;
    expect(planKernelSigning({ ...ecdsaRoot, rootValidatorId: null, ecdsaInstalled: false })).toBe('ecdsa-root');
    expect(planKernelSigning({ ...ecdsaRoot, rootValidatorId: null, ecdsaInstalled: false, devicePasskeyUsable: true })).toBe('ecdsa-root');
    expect(planKernelSigning(ecdsaRoot)).toBe('ecdsa-root');
    expect(planKernelSigning({ ...ecdsaRoot, devicePasskeyUsable: true })).toBe('device-passkey');
    expect(planKernelSigning({ ...ecdsaRoot, devicePasskeyUsable: true, purpose: 'sign' })).toBe('ecdsa-root');
    const legacy = { ...ecdsaRoot, rootValidatorId: PASSKEY_ROOT } as const;
    expect(planKernelSigning({ ...legacy, passkeyUsable: true })).toBe('passkey');
    expect(planKernelSigning(legacy)).toBe('unavailable');
    expect(planKernelSigning({ ...legacy, ecdsaCanExecute: true })).toBe('ecdsa-secondary');
    expect(planKernelSigning({ ...legacy, purpose: 'sign' })).toBe('ecdsa-secondary');
    const migrated = { ...ecdsaRoot, ecdsaCanExecute: true, passkeyUsable: true } as const;
    expect(planKernelSigning(migrated)).toBe('ecdsa-root');
    expect(planKernelSigning({ ...migrated, devicePasskeyUsable: true })).toBe('device-passkey');
  });

  test('validation ids are the secondary-type prefix plus the lowercase address', () => {
    expect(validationIdOf(ECDSA)).toBe('0x01845adb2c711129d4f3966735ed98a9f09fc4ce57');
  });
});
