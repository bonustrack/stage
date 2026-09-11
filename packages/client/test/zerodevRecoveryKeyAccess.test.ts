import { describe, expect, test } from 'bun:test';
import { decodeAbiParameters } from 'viem';
import {
  KERNEL_NO_HOOK, encodeInstallValidator, encodeUninstallValidator, encodeValidatorInstallData, recoveryKeyAccessCalls,
} from '../src/zerodev/recoveryKeyAccess';
import { KERNEL_EXECUTE_SELECTOR } from '../src/zerodev/validatorPlan';

const ACCOUNT = '0x00000000000000000000000000000000000000AA';
const ECDSA = '0x845ADb2C711129d4f3966735eD98a9F09fC4cE57';
const OWNER = '0x8169b0e98dCe2203C08Fd3e7A7f1b1c1aCD1962c';

describe('recovery key access encoding', () => {
  test('install data is the no-hook sentinel followed by owner, empty hook data and the selector', () => {
    const data = encodeValidatorInstallData(OWNER, KERNEL_EXECUTE_SELECTOR);
    expect(data.startsWith(KERNEL_NO_HOOK)).toBe(true);
    const [validatorData, hookData, selectorData] = decodeAbiParameters(
      [{ type: 'bytes' }, { type: 'bytes' }, { type: 'bytes' }], `0x${data.slice(2 + 40)}`,
    );
    expect(validatorData.toLowerCase()).toBe(OWNER.toLowerCase());
    expect(hookData).toBe('0x');
    expect(selectorData).toBe(KERNEL_EXECUTE_SELECTOR);
  });

  test('revoking installs without a selector', () => {
    const [, , selectorData] = decodeAbiParameters(
      [{ type: 'bytes' }, { type: 'bytes' }, { type: 'bytes' }], `0x${encodeValidatorInstallData(OWNER, null).slice(42)}`,
    );
    expect(selectorData).toBe('0x');
  });

  test('uses the Kernel installModule and uninstallValidation selectors', () => {
    expect(encodeInstallValidator(ECDSA, OWNER, KERNEL_EXECUTE_SELECTOR).startsWith('0x9517e29f')).toBe(true);
    expect(encodeUninstallValidator(ECDSA, OWNER).startsWith('0xe6f3d50a')).toBe(true);
  });

  test('produces one uninstall and one reinstall call against the account', () => {
    const calls = recoveryKeyAccessCalls(ACCOUNT, ECDSA, OWNER, true);
    expect(calls.map((c) => c.to)).toEqual([ACCOUNT, ACCOUNT]);
    expect(calls[0]?.data.startsWith('0xe6f3d50a')).toBe(true);
    expect(calls[1]?.data.startsWith('0x9517e29f')).toBe(true);
  });
});
