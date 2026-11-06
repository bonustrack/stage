import { describe, expect, test } from 'bun:test';
import { phrasePanelActions, securityRows, type SecurityRowsInput } from '../components/settings/SecuritySettings.model';

const SMART: SecurityRowsInput = { isSmart: true, backedUp: true, canExportKey: false, keyRevealed: false };

describe('securityRows', () => {
  test('a backed-up smart account only offers its recovery phrase', () => {
    expect(securityRows(SMART)).toEqual(['showPhrase']);
  });

  test('a device that still needs a backup leads with it', () => {
    expect(securityRows({ ...SMART, backedUp: false })).toEqual(['backupPhrase']);
  });

  test('backup row waits for the stored flag', () => {
    expect(securityRows({ ...SMART, backedUp: null })).not.toContain('backupPhrase');
    expect(securityRows({ ...SMART, backedUp: null })).not.toContain('showPhrase');
  });

  test('key accounts offer key export until revealed', () => {
    const legacy: SecurityRowsInput = { ...SMART, isSmart: false, backedUp: false, canExportKey: true };
    expect(securityRows(legacy)).toEqual(['exportKey']);
    expect(securityRows({ ...legacy, backedUp: true })).toEqual(['exportKey']);
    expect(securityRows({ ...legacy, keyRevealed: true })).toEqual([]);
  });
});

describe('recovery phrase panel', () => {
  test('backup mode asks to confirm the save, show mode only offers hide', () => {
    expect(phrasePanelActions('backup')).toEqual(['hide', 'saved']);
    expect(phrasePanelActions('show')).toEqual(['hide']);
  });
});
