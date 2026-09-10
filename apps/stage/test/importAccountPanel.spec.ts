import { describe, expect, test } from 'bun:test';
import {
  IMPORT_EMPTY, IMPORT_INVALID, parseImportInput, transferWarning,
} from '../components/accounts/ImportAccountPanel.model';

const PK = '0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318';

describe('parseImportInput', () => {
  test('rejects empty input with a hint', () => {
    expect(parseImportInput('   ')).toEqual({ ok: false, error: IMPORT_EMPTY });
  });

  test('rejects text that is neither a code, a key, nor a phrase', () => {
    expect(parseImportInput('not a key')).toEqual({ ok: false, error: IMPORT_INVALID });
  });

  test('accepts a transfer code and a raw key', () => {
    expect(parseImportInput(`stage-account:1:pk:${PK}`)).toEqual({ ok: true, transfer: { kind: 'pk', pk: PK } });
    expect(parseImportInput(PK)).toEqual({ ok: true, transfer: { kind: 'pk', pk: PK } });
  });
});

describe('transferWarning', () => {
  test('names what the code exposes', () => {
    expect(transferWarning('pk')).toContain('private key');
    expect(transferWarning('phrase')).toContain('recovery phrase');
  });
});
