import { describe, expect, test } from 'bun:test';
import { decodeFunctionData, parseAbi, toFunctionSelector, zeroAddress, type Hex } from 'viem';
import { encodeChangeRootToEcdsa, planRootKeyMigration, rootKeyMigrationCalls } from '../src/zerodev/rootKey';
import { validationIdOf } from '../src/zerodev/validatorPlan';

const ECDSA: Hex = '0x845ADb2C711129d4f3966735eD98a9F09fC4cE57';
const PASSKEY_VALIDATOR = '0x7ab16ff354acb328452f1d445b3ddee9a91e9e69';
const PASSKEY_ROOT: Hex = `0x01${PASSKEY_VALIDATOR.slice(2)}`;
const ACCOUNT: Hex = '0x00000000000000000000000000000000000000AA';
const OWNER: Hex = '0x00000000000000000000000000000000000000Bb';
const KERNEL = parseAbi([
  'function changeRootValidator(bytes21 _rootValidator, address hook, bytes validatorData, bytes hookData)',
  'function uninstallValidation(bytes21 vId, bytes deinitData, bytes hookDeinitData)',
]);

const LEGACY = {
  rootValidatorId: PASSKEY_ROOT, ecdsaInstalled: true, ecdsaCanExecute: false, ecdsaValidator: ECDSA, passkeyUsable: false, passkeyRoot: true,
} as const;

describe('planRootKeyMigration', () => {
  test('nothing to do for accounts already rooted in the recovery phrase or not deployed', () => {
    expect(planRootKeyMigration({ ...LEGACY, passkeyRoot: false })).toBe('not-needed');
    expect(planRootKeyMigration({ ...LEGACY, rootValidatorId: null })).toBe('not-needed');
    expect(planRootKeyMigration({ ...LEGACY, rootValidatorId: validationIdOf(ECDSA) })).toBe('not-needed');
  });

  test('the passkey device signs with the root passkey', () => {
    expect(planRootKeyMigration({ ...LEGACY, passkeyUsable: true })).toBe('passkey');
    expect(planRootKeyMigration({ ...LEGACY, passkeyUsable: true, ecdsaCanExecute: true })).toBe('passkey');
  });

  test('a device without the passkey migrates alone when the recovery key may execute or it has its own passkey', () => {
    expect(planRootKeyMigration({ ...LEGACY, ecdsaCanExecute: true })).toBe('recovery-key');
    expect(planRootKeyMigration({ ...LEGACY, devicePasskeyUsable: true })).toBe('device-passkey');
  });

  test('otherwise it has to happen on the passkey device', () => {
    expect(planRootKeyMigration(LEGACY)).toBe('elsewhere');
    expect(planRootKeyMigration({ ...LEGACY, ecdsaInstalled: false, ecdsaCanExecute: false })).toBe('elsewhere');
  });
});

describe('rootKeyMigrationCalls', () => {
  test('changeRootValidator points the root at the ECDSA validator with the owner as install data and no hook', () => {
    const decoded = decodeFunctionData({ abi: KERNEL, data: encodeChangeRootToEcdsa(ECDSA, OWNER) });
    expect(decoded.functionName).toBe('changeRootValidator');
    expect(decoded.args[0]).toBe(validationIdOf(ECDSA));
    expect(decoded.args[1]).toBe(zeroAddress);
    expect(decoded.args[2].toLowerCase()).toBe(OWNER.toLowerCase());
    expect(decoded.args[3]).toBe('0x');
  });

  test('two self-calls, so the kernel runs them through execute: swap the root, then retire the old passkey validator', () => {
    const calls = rootKeyMigrationCalls(ACCOUNT, ECDSA, OWNER, PASSKEY_ROOT);
    expect(calls.length).toBe(2);
    expect(calls.every((c) => c.to === ACCOUNT && c.value === 0n)).toBe(true);
    expect(calls[0]?.data.slice(0, 10)).toBe(toFunctionSelector(KERNEL[0]));
    const uninstall = decodeFunctionData({ abi: KERNEL, data: calls[1]?.data ?? '0x' });
    expect(uninstall.functionName).toBe('uninstallValidation');
    expect(uninstall.args[0]).toBe(PASSKEY_ROOT);
    expect(uninstall.args[1]).toBe('0x');
  });

  test('refuses to retire the ECDSA validator or a non-validator root', () => {
    expect(() => rootKeyMigrationCalls(ACCOUNT, ECDSA, OWNER, validationIdOf(ECDSA))).toThrow();
    expect(() => rootKeyMigrationCalls(ACCOUNT, ECDSA, OWNER, '0x021234567800000000000000000000000000000000')).toThrow();
  });
});
