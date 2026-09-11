import { describe, expect, test } from 'bun:test';
import { claimIsFresh, claimMessage, isStageName, stageNameOf, validateStageLabel } from '../src/identity/stageNames';

describe('validateStageLabel', () => {
  test('accepts six or more lowercase letters, digits and inner hyphens', () => {
    expect(validateStageLabel('fabien')).toBeNull();
    expect(validateStageLabel('stage-42')).toBeNull();
  });

  test('rejects short, long, uppercase and badly placed hyphens', () => {
    expect(validateStageLabel('short')).toBe('too-short');
    expect(validateStageLabel('a'.repeat(33))).toBe('too-long');
    expect(validateStageLabel('Fabien')).toBe('characters');
    expect(validateStageLabel('-fabien')).toBe('characters');
    expect(validateStageLabel('fabien-')).toBe('characters');
    expect(validateStageLabel('fab.ien')).toBe('characters');
  });
});

describe('names and claims', () => {
  test('builds and recognises stage names', () => {
    expect(stageNameOf('fabien')).toBe('fabien.stage.base.eth');
    expect(isStageName('fabien.stage.base.eth')).toBe(true);
    expect(isStageName('fabien.base.eth')).toBe(false);
  });

  test('claim messages are lowercase-address and time bound', () => {
    expect(claimMessage({ label: 'fabien', address: '0xABCDEF', issuedAt: 1700000000000 }))
      .toBe('Claim fabien.stage.base.eth for 0xabcdef at 1700000000000');
    expect(claimIsFresh(1000, 1000 + 5 * 60 * 1000)).toBe(true);
    expect(claimIsFresh(1000, 1000 + 11 * 60 * 1000)).toBe(false);
    expect(claimIsFresh(Number.NaN, 5)).toBe(false);
  });
});
