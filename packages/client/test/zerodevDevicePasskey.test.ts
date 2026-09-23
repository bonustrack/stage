import { describe, expect, test } from 'bun:test';
import { decodeAbiParameters, decodeFunctionData, parseAbi, type Hex } from 'viem';
import {
  SUDO_POLICY, WEBAUTHN_SIGNER_V0_0_4, checkDevicePasskeyApproval, devicePasskeyEnableData, devicePasskeyFingerprint,
  devicePasskeyPermissionId, devicePasskeySignerData, encodeDevicePasskeyApproval, encodeDevicePasskeyRequest,
  enableDevicePasskeyCalls, encodeUninstallDevicePasskey, isDevicePasskeyInstalled, removeDevicePasskeyCalls, parseDevicePasskeyApproval, parseDevicePasskeyRequest,
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

  test('fingerprints are short, readable and key specific', () => {
    expect(devicePasskeyFingerprint(KEY)).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}$/);
    expect(devicePasskeyFingerprint(OTHER)).not.toBe(devicePasskeyFingerprint(KEY));
  });

  test('installed means an enabled validation, the patched WebAuthn signer and the execute selector', () => {
    const live = { hook: '0x0000000000000000000000000000000000000001', signer: WEBAUTHN_SIGNER_V0_0_4, canExecute: true } as const;
    expect(isDevicePasskeyInstalled(live)).toBe(true);
    expect(isDevicePasskeyInstalled({ ...live, canExecute: false })).toBe(false);
    expect(isDevicePasskeyInstalled({ ...live, signer: '0x0000000000000000000000000000000000000000' })).toBe(false);
    expect(isDevicePasskeyInstalled({ ...live, hook: '0x0000000000000000000000000000000000000000' })).toBe(false);
  });
});

describe('device passkey codes', () => {
  test('a request round-trips and carries only public data', () => {
    const code = encodeDevicePasskeyRequest({ account: ACCOUNT, key: KEY });
    expect(code.startsWith('stage-device-passkey:1:0x')).toBe(true);
    const parsed = parseDevicePasskeyRequest(`  ${code.toUpperCase().replace('STAGE-DEVICE-PASSKEY', 'stage-device-passkey')} `);
    expect(parsed?.account.toLowerCase()).toBe(ACCOUNT.toLowerCase());
    expect(parsed && BigInt(parsed.key.pubY)).toBe(0xabcn);
    expect(parsed && devicePasskeyPermissionId(parsed.key)).toBe(devicePasskeyPermissionId(KEY));
  });

  test('malformed requests are rejected', () => {
    expect(parseDevicePasskeyRequest('hello')).toBeNull();
    expect(parseDevicePasskeyRequest('stage-device-passkey:1:0x12:0x1:0x2:0x3')).toBeNull();
    const code = encodeDevicePasskeyRequest({ account: ACCOUNT, key: KEY });
    expect(parseDevicePasskeyRequest(code.replace(':1:', ':2:'))).toBeNull();
    expect(parseDevicePasskeyRequest(`${code}:extra`)).toBeNull();
  });

  test('an approval round-trips', () => {
    const approval = { account: ACCOUNT, permissionId: devicePasskeyPermissionId(KEY), nonce: 3, enableSignature: '0xdeadbeef' as Hex };
    const parsed = parseDevicePasskeyApproval(encodeDevicePasskeyApproval(approval));
    expect(parsed?.nonce).toBe(3);
    expect(parsed?.enableSignature).toBe('0xdeadbeef');
    expect(parsed?.permissionId).toBe(approval.permissionId);
    expect(parseDevicePasskeyApproval('stage-device-approval:1:0xaa:0x1234:1:0x00')).toBeNull();
    expect(parseDevicePasskeyApproval(encodeDevicePasskeyApproval({ ...approval, enableSignature: '0xabc' }))).toBeNull();
  });

  test('an approval must match this account, this passkey and the current validator nonce', () => {
    const approval = { account: ACCOUNT, permissionId: devicePasskeyPermissionId(KEY), nonce: 2, enableSignature: '0x00' as Hex };
    expect(checkDevicePasskeyApproval(approval, ACCOUNT, KEY, 2)).toBe('ok');
    expect(checkDevicePasskeyApproval(approval, '0x00000000000000000000000000000000000000Bb', KEY, 2)).toBe('other-account');
    expect(checkDevicePasskeyApproval(approval, ACCOUNT, OTHER, 2)).toBe('other-passkey');
    expect(checkDevicePasskeyApproval(approval, ACCOUNT, KEY, 3)).toBe('stale');
    expect(checkDevicePasskeyApproval({ ...approval, nonce: 1 }, ACCOUNT, KEY, 0)).toBe('ok');
  });
});
