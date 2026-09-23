import { describe, expect, test } from 'bun:test';
import {
  APPROVE_SHEET_COPY, DEVICE_SHEET_COPY, REMOVE_DEVICE_PASSKEY, approveRowVisible, devicePasskeyRowCopy, devicePasskeyState,
  devicePasskeyValue, fingerprintLine,
} from '../components/settings/DevicePasskeyRow.model';

describe('devicePasskeyState', () => {
  test('without passkey support the row only explains why', () => {
    expect(devicePasskeyState({ available: false, stored: true, installed: true })).toBe('unavailable');
  });

  test('offers to add a passkey until one is created here', () => {
    expect(devicePasskeyState({ available: true, stored: false, installed: undefined })).toBe('add');
  });

  test('a created passkey is pending until the account has it on-chain', () => {
    expect(devicePasskeyState({ available: true, stored: true, installed: undefined })).toBe('loading');
    expect(devicePasskeyState({ available: true, stored: true, installed: false })).toBe('pending');
    expect(devicePasskeyState({ available: true, stored: true, installed: true })).toBe('active');
    expect(devicePasskeyState({ available: true, stored: true, installed: null })).toBe('unknown');
  });
});

describe('device passkey copy', () => {
  test('rows and sheets name the action and who approves it', () => {
    expect(devicePasskeyRowCopy('add').label).toBe('Add a passkey for this device');
    expect(devicePasskeyRowCopy('pending').description).toContain('account passkey');
    expect(devicePasskeyValue('active')).toContain('Approves transactions');
    expect(DEVICE_SHEET_COPY.request).toContain('Approve a passkey from another device');
    expect(APPROVE_SHEET_COPY.intro).toContain('Add a passkey for this device');
    expect(REMOVE_DEVICE_PASSKEY.message).toContain('keeps full control');
    expect(fingerprintLine('ABCD-1234')).toBe('Check that both devices show ABCD-1234.');
  });

  test('copy never uses an em dash', () => {
    const all = [
      ...Object.values(DEVICE_SHEET_COPY), ...Object.values(APPROVE_SHEET_COPY), ...Object.values(REMOVE_DEVICE_PASSKEY),
      devicePasskeyRowCopy('add').description, devicePasskeyRowCopy('pending').description,
    ].join(' ');
    expect(all.includes(String.fromCharCode(0x2014))).toBe(false);
  });

  test('the approve row is only for accounts rooted in a passkey', () => {
    expect(approveRowVisible('passkey-root')).toBe(true);
    expect(approveRowVisible('ecdsa-root')).toBe(false);
    expect(approveRowVisible(null)).toBe(false);
  });
});
