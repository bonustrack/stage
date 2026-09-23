import { describe, expect, test } from 'bun:test';
import {
  BACKUP_PHRASE_COPY, SHOW_PHRASE_COPY, SHOWN_PHRASE_TIMEOUT_MS,
  phrasePanelActions, phraseRowCopy, securityRows, type SecurityRowsInput,
} from '../components/settings/SecuritySettings.model';

const SMART: SecurityRowsInput = {
  isSmart: true, backedUp: true, custody: 'ecdsa-root', devicePasskeyStored: false,
  canExportKey: false, keyRevealed: false, canLinkDevice: true,
};

describe('securityRows', () => {
  test('a fresh recovery-phrase account offers a passkey for this device and nothing about migration', () => {
    expect(securityRows(SMART)).toEqual(['devicePasskey', 'showPhrase', 'linkDevice', 'removeAccount']);
    expect(securityRows({ ...SMART, custody: 'undeployed' })).toEqual(['devicePasskey', 'showPhrase', 'linkDevice', 'removeAccount']);
  });

  test('a recovery-phrase account with a device passkey keeps the same single passkey row', () => {
    expect(securityRows({ ...SMART, devicePasskeyStored: true })).toEqual(['devicePasskey', 'showPhrase', 'linkDevice', 'removeAccount']);
  });

  test('a legacy passkey-rooted account leads with the migration and keeps the legacy rows', () => {
    expect(securityRows({ ...SMART, custody: 'passkey-root' })).toEqual([
      'rootKey', 'passkeyLink', 'recoveryKey', 'showPhrase', 'linkDevice', 'removeAccount',
    ]);
    expect(securityRows({ ...SMART, custody: 'passkey-root', devicePasskeyStored: true })).toEqual([
      'rootKey', 'passkeyLink', 'devicePasskey', 'recoveryKey', 'showPhrase', 'linkDevice', 'removeAccount',
    ]);
  });

  test('no key rows while custody is loading or when another signer controls the account', () => {
    for (const custody of [null, 'other-root'] as const) {
      expect(securityRows({ ...SMART, custody })).toEqual(['showPhrase', 'linkDevice', 'removeAccount']);
    }
  });

  test('a device that still needs a backup leads with it', () => {
    expect(securityRows({ ...SMART, backedUp: false })).toEqual(['backupPhrase', 'devicePasskey', 'linkDevice', 'removeAccount']);
  });

  test('backup row waits for the stored flag', () => {
    expect(securityRows({ ...SMART, backedUp: null })).not.toContain('backupPhrase');
    expect(securityRows({ ...SMART, backedUp: null })).not.toContain('showPhrase');
  });

  test('legacy key account offers key export until revealed, no passkey rows', () => {
    const legacy: SecurityRowsInput = { ...SMART, isSmart: false, custody: null, backedUp: false, canExportKey: true, canLinkDevice: false };
    expect(securityRows(legacy)).toEqual(['exportKey', 'removeAccount']);
    expect(securityRows({ ...legacy, backedUp: true })).toEqual(['exportKey', 'removeAccount']);
    expect(securityRows({ ...legacy, keyRevealed: true })).toEqual(['removeAccount']);
  });
});

describe('recovery phrase panel', () => {
  test('backup mode keeps its copy and asks to confirm the save', () => {
    expect(phraseRowCopy('backup').label).toBe(BACKUP_PHRASE_COPY.label);
    expect(phrasePanelActions('backup')).toEqual(['hide', 'saved']);
  });

  test('show mode only offers hide and has a destructive-style confirm', () => {
    expect(phraseRowCopy('show').label).toBe('Show recovery phrase');
    expect(phrasePanelActions('show')).toEqual(['hide']);
    expect(SHOW_PHRASE_COPY.confirmTitle).toBe('Show recovery phrase?');
    expect(SHOW_PHRASE_COPY.confirmLabel).toBe('Show');
  });

  test('shown phrase hides after about a minute', () => {
    expect(SHOWN_PHRASE_TIMEOUT_MS).toBe(60_000);
  });
});
