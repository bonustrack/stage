import { describe, expect, test } from 'bun:test';
import {
  BACKUP_PHRASE_COPY, SHOW_PHRASE_COPY, SHOWN_PHRASE_TIMEOUT_MS,
  phrasePanelActions, phraseRowCopy, securityRows, type SecurityRowsInput,
} from '../components/settings/SecuritySettings.model';

const SMART: SecurityRowsInput = {
  isSmart: true, backedUp: true,
  canExportKey: false, keyRevealed: false,
};

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
