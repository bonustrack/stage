import { describe, expect, test } from 'bun:test';
import {
  BACKUP_PHRASE_COPY, SHOW_PHRASE_COPY, SHOWN_PHRASE_TIMEOUT_MS,
  passkeyActionLabel, phrasePanelActions, phraseRowCopy, securityRows, type SecurityRowsInput,
} from '../components/settings/SecuritySettings.model';

const SMART: SecurityRowsInput = {
  isSmart: true, backedUp: true, enablePasskey: false, removePasskey: false,
  canExportKey: false, keyRevealed: false, canLinkDevice: true,
};

describe('securityRows', () => {
  test('smart account with a passkey and a backup', () => {
    expect(securityRows({ ...SMART, removePasskey: true })).toEqual([
      'passkeyLink', 'recoveryKey', 'showPhrase', 'removePasskey', 'linkDevice', 'removeAccount',
    ]);
  });

  test('smart account that still needs a backup and a passkey leads with those actions', () => {
    expect(securityRows({ ...SMART, backedUp: false, enablePasskey: true })).toEqual([
      'backupPhrase', 'enablePasskey', 'passkeyLink', 'recoveryKey', 'linkDevice', 'removeAccount',
    ]);
  });

  test('backup row waits for the stored flag', () => {
    expect(securityRows({ ...SMART, backedUp: null })).not.toContain('backupPhrase');
    expect(securityRows({ ...SMART, backedUp: null })).not.toContain('showPhrase');
  });

  test('show row replaces the backup row once the phrase is backed up', () => {
    expect(securityRows({ ...SMART, backedUp: false })).not.toContain('showPhrase');
    expect(securityRows(SMART)).toContain('showPhrase');
    expect(securityRows(SMART)).not.toContain('backupPhrase');
  });

  test('legacy account offers key export until revealed, no passkey rows', () => {
    const legacy: SecurityRowsInput = { ...SMART, isSmart: false, backedUp: false, canExportKey: true, canLinkDevice: false };
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

describe('passkeyActionLabel', () => {
  test('keeps the enable and remove copy with busy states', () => {
    expect(passkeyActionLabel('enable', false)).toBe('Enable passkey for signing');
    expect(passkeyActionLabel('enable', true)).toBe('Enabling passkey…');
    expect(passkeyActionLabel('remove', false)).toBe('Remove passkey');
    expect(passkeyActionLabel('remove', true)).toBe('Removing passkey…');
  });
});
