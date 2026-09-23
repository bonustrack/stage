import { describe, expect, test } from 'bun:test';
import { decodeAbiParameters, decodeFunctionData, parseAbi, type Hex } from 'viem';
import {
  SUDO_POLICY, WEBAUTHN_SIGNER_V0_0_4, devicePasskeyEnableData, devicePasskeyPermissionId, devicePasskeySignerData,
  enableDevicePasskeyCalls, encodeUninstallDevicePasskey, isDevicePasskeyInstalled, removeDevicePasskeyCalls,
  permissionValidationId, type DevicePasskeyKey,
} from '../src/zerodev/devicePasskey';

const ACCOUNT: Hex = '0x00000000000000000000000000000000000000AA';
const KEY: DevicePasskeyKey = {
  pubX: '0x1f2e3d4c5b6a79881f2e3d4c5b6a79881f2e3d4c5b6a79881f2e3d4c5b6a7988',
  pubY: '0xabc',
  authenticatorIdHash: '0x9999999999999999999999999999999999999999999999999999999999999999',
};
const OTHER: DevicePasskeyKey = { ...KEY, pubY: '0xabd' };

describe('device passkey permission encoding', () => {
  test('enable data lists the sudo policy then the WebAuthn signer with the key', () => {
    const [entries] = decodeAbiParameters([{ type: 'bytes[]' }], devicePasskeyEnableData(KEY));
    expect(entries.length).toBe(2);
    expect(entries[0]?.toLowerCase()).toBe(`0x0000${SUDO_POLICY.slice(2)}`.toLowerCase());
    const signer = entries[1] ?? '0x';
    expect(signer.slice(0, 6)).toBe('0x0000');
    expect(`0x${signer.slice(6, 46)}`.toLowerCase()).toBe(WEBAUTHN_SIGNER_V0_0_4.toLowerCase());
    expect(`0x${signer.slice(46)}`).toBe(devicePasskeySignerData(KEY));
    const [point, idHash] = decodeAbiParameters(
      [{ type: 'tuple', components: [{ name: 'x', type: 'uint256' }, { name: 'y', type: 'uint256' }] }, { type: 'bytes32' }],
      devicePasskeySignerData(KEY),
    );
    expect(point.x).toBe(BigInt(KEY.pubX));
    expect(point.y).toBe(0xabcn);
    expect(idHash).toBe(KEY.authenticatorIdHash);
  });

  test('the permission id is four bytes, stable, and differs per key', () => {
    const id = devicePasskeyPermissionId(KEY);
    expect(id).toMatch(/^0x[0-9a-f]{8}$/);
    expect(devicePasskeyPermissionId(KEY)).toBe(id);
    expect(devicePasskeyPermissionId(OTHER)).not.toBe(id);
  });

  test('the validation id is the permission type byte plus the right-padded permission id', () => {
    expect(permissionValidationId('0x12345678')).toBe('0x021234567800000000000000000000000000000000');
    expect(permissionValidationId('0x12345678').length).toBe(2 + 42);
  });

  test('uninstall targets the permission validation with one empty entry per policy and signer', () => {
    const decoded = decodeFunctionData({
      abi: parseAbi(['function uninstallValidation(bytes21 vId, bytes deinitData, bytes hookDeinitData)']),
      data: encodeUninstallDevicePasskey('0x12345678'),
    });
    expect(decoded.args[0]).toBe('0x021234567800000000000000000000000000000000');
    const [entries] = decodeAbiParameters([{ type: 'bytes[]' }], decoded.args[1]);
    expect(entries).toEqual(['0x', '0x']);
    expect(decoded.args[2]).toBe('0x');
  });

  test('removal is a batch so the kernel runs it through execute, the only selector a secondary validator may call', () => {
    const calls = removeDevicePasskeyCalls(ACCOUNT, '0x12345678');
    expect(calls.length).toBeGreaterThan(1);
    expect(calls[0]?.to).toBe(ACCOUNT);
    expect(calls[0]?.data).toBe(encodeUninstallDevicePasskey('0x12345678'));
    expect(calls.slice(1).every((c) => c.value === 0n && c.data === '0x' && c.to !== ACCOUNT)).toBe(true);
  });

  test('the enabling operation moves no value and never calls the account itself', () => {
    expect(enableDevicePasskeyCalls().every((c) => c.value === 0n && c.data === '0x' && c.to !== ACCOUNT)).toBe(true);
  });

  test('installed means an enabled validation, the patched WebAuthn signer and the execute selector', () => {
    const live = { hook: '0x0000000000000000000000000000000000000001', signer: WEBAUTHN_SIGNER_V0_0_4, canExecute: true } as const;
    expect(isDevicePasskeyInstalled(live)).toBe(true);
    expect(isDevicePasskeyInstalled({ ...live, canExecute: false })).toBe(false);
    expect(isDevicePasskeyInstalled({ ...live, signer: '0x0000000000000000000000000000000000000000' })).toBe(false);
    expect(isDevicePasskeyInstalled({ ...live, hook: '0x0000000000000000000000000000000000000000' })).toBe(false);
  });
});
