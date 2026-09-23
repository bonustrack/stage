import { describe, expect, test } from 'bun:test';
import { passkeyActionLabel, securityRows, type SecurityRowsInput } from '../components/settings/SecuritySettings.model';

const SMART: SecurityRowsInput = {
  isSmart: true, backedUp: true, enablePasskey: false, removePasskey: false,
  canExportKey: false, keyRevealed: false, canLinkDevice: true,
};

describe('securityRows', () => {
  test('smart account with a passkey and a backup', () => {
    expect(securityRows({ ...SMART, removePasskey: true })).toEqual([
      'passkeyLink', 'recoveryKey', 'removePasskey', 'linkDevice', 'removeAccount',
    ]);
  });

  test('smart account that still needs a backup and a passkey leads with those actions', () => {
    expect(securityRows({ ...SMART, backedUp: false, enablePasskey: true })).toEqual([
      'backupPhrase', 'enablePasskey', 'passkeyLink', 'recoveryKey', 'linkDevice', 'removeAccount',
    ]);
  });

  test('backup row waits for the stored flag', () => {
    expect(securityRows({ ...SMART, backedUp: null })).not.toContain('backupPhrase');
  });

  test('legacy account offers key export until revealed, no passkey rows', () => {
    const legacy: SecurityRowsInput = { ...SMART, isSmart: false, backedUp: false, canExportKey: true, canLinkDevice: false };
    expect(securityRows(legacy)).toEqual(['exportKey', 'removeAccount']);
    expect(securityRows({ ...legacy, keyRevealed: true })).toEqual(['removeAccount']);
  });
});

describe('passkeyActionLabel', () => {
  test('keeps the enable and remove copy with busy states', () => {
    expect(passkeyActionLabel('enable', false)).toBe('Enable passkey for signing');
    expect(passkeyActionLabel('enable', true)).toBe('Enabling passkey…');
    expect(passkeyActionLabel('remove', false)).toBe('Remove passkey');
    expect(passkeyActionLabel('remove', true)).toBe('Removing passkey…');
  });
});
