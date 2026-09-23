import { describe, expect, test } from 'bun:test';
import {
  DEVICE_PASSKEY_DONE, ENABLE_PASSKEY_CONFIRM, ENABLE_PASSKEY_ROW, REMOVE_DEVICE_PASSKEY, devicePasskeyState, devicePasskeyValue,
} from '../components/settings/DevicePasskeyRow.model';
import {
  KEEP_PASSKEY_CONFIRM, ROOT_KEY_CONFIRM, ROOT_KEY_DONE, ROOT_KEY_LABEL, rootKeyActionable, rootKeyDescription,
} from '../components/settings/RootKeyRow.model';

const EM_DASH = String.fromCharCode(0x2014);

describe('devicePasskeyState', () => {
  test('without passkey support the row only explains why', () => {
    expect(devicePasskeyState({ available: false, stored: true, installed: true })).toBe('unavailable');
  });

  test('offers Enable passkey until this device has one installed on-chain', () => {
    expect(devicePasskeyState({ available: true, stored: false, installed: undefined })).toBe('add');
    expect(devicePasskeyState({ available: true, stored: true, installed: false })).toBe('add');
  });

  test('a stored passkey is checked on-chain before it shows as active', () => {
    expect(devicePasskeyState({ available: true, stored: true, installed: undefined })).toBe('loading');
    expect(devicePasskeyState({ available: true, stored: true, installed: true })).toBe('active');
    expect(devicePasskeyState({ available: true, stored: true, installed: null })).toBe('unknown');
  });
});

describe('device passkey copy', () => {
  test('Enable passkey says the recovery phrase stays the main key and needs no other device', () => {
    expect(ENABLE_PASSKEY_ROW.label).toBe('Enable passkey');
    expect(ENABLE_PASSKEY_ROW.description).toContain('recovery phrase stays the main key');
    expect(ENABLE_PASSKEY_CONFIRM.message).not.toContain('other device');
    expect(devicePasskeyValue('active')).toContain('Approves transactions');
    expect(REMOVE_DEVICE_PASSKEY.label).toBe("Remove this device's passkey");
  });

  test('copy never uses an em dash', () => {
    const all = [
      ...Object.values(ENABLE_PASSKEY_ROW), ...Object.values(ENABLE_PASSKEY_CONFIRM), ...Object.values(REMOVE_DEVICE_PASSKEY), DEVICE_PASSKEY_DONE,
      ...Object.values(ROOT_KEY_CONFIRM), ...Object.values(KEEP_PASSKEY_CONFIRM), ROOT_KEY_DONE, ROOT_KEY_LABEL,
    ].join(' ');
    expect(all.includes(EM_DASH)).toBe(false);
  });
});

describe('root key migration row', () => {
  test('only the paths this device can sign are actionable', () => {
    expect(rootKeyActionable('passkey')).toBe(true);
    expect(rootKeyActionable('device-passkey')).toBe(true);
    expect(rootKeyActionable('recovery-key')).toBe(true);
    for (const state of ['elsewhere', 'loading', 'unknown', 'not-needed'] as const) expect(rootKeyActionable(state)).toBe(false);
  });

  test('each path explains who approves the change', () => {
    expect(rootKeyDescription('passkey')).toContain('Approve once with that passkey');
    expect(rootKeyDescription('recovery-key')).toContain('this device can make the recovery phrase the main key by itself');
    expect(rootKeyDescription('elsewhere')).toContain('on the device that has that passkey');
    expect(ROOT_KEY_LABEL).toBe('Make your recovery phrase the main key');
  });
});
