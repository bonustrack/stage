import { describe, expect, test } from 'bun:test';
import {
  BACKUP_PHRASE_COPY,
  SHOW_PHRASE_COPY,
  SHOWN_PHRASE_TIMEOUT_MS,
  phrasePanelActions,
  phraseCopy,
  phraseRowCopy,
  securityRows,
  signInCopy,
  securityRowLabel,
  type SecurityRowsInput,
} from '../components/settings/SecuritySettings.model';
import { logOutMessage } from '../components/settings/accountRemoval.model';

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

  test('a build without the wallet warns about the account, never the wallet', () => {
    const copy = phraseCopy(false);
    expect(copy.show.confirmMessage).toBe('Anyone who sees it controls your account. Make sure nobody is watching your screen.');
    expect(JSON.stringify(copy)).not.toContain('wallet');
    expect(phraseCopy(true).backup.revealed).toContain('controls your wallet');
  });

  test('shown phrase hides after about a minute', () => {
    expect(SHOWN_PHRASE_TIMEOUT_MS).toBe(60_000);
  });
});

describe('securityRowLabel', () => {
  test('a Privy account has no phrase or key to show', () => {
    expect(securityRowLabel('privy')).toBe('Sign-in');
    expect(securityRowLabel('smart')).toBe('Recovery phrase and private key');
    expect(securityRowLabel(undefined)).toBe('Recovery phrase and private key');
  });
});

describe('signInCopy', () => {
  test('a social sign-in explains there is no phrase to back up', () => {
    const copy = signInCopy('google');
    expect(copy.title).toBe('Signed in with Google');
    expect(copy.note).toContain('no recovery phrase');
    expect(copy.action).toBe('Sign in again');
    expect(signInCopy('microsoft').mismatch).toContain('Microsoft');
  });

  test('a web3 wallet keeps its own recovery phrase', () => {
    const copy = signInCopy('wallet');
    expect(copy.title).toBe('Signed in with your wallet');
    expect(copy.note).toContain('recovery phrase');
    expect(copy.action).toBe('Reconnect wallet');
  });
});

describe('logOutMessage', () => {
  test('says how to come back and what happens to the messages here', () => {
    const message = logOutMessage('0x9724...f139', 'Google');
    expect(message).toContain('Sign in with Google again');
    expect(message).toContain('messages on this device are deleted');
  });
});
