
import { describe, expect, test } from 'bun:test';
import { fmtUsdValue } from '../src/wallet/prices';

describe('fmtUsdValue', () => {
  test('null price -> null (amount only)', () => {
    expect(fmtUsdValue('50', null)).toBeNull();
  });
  test('0.1 ETH @ $3500 -> ~$350', () => {
    expect(fmtUsdValue('0.1', 3500)).toBe('~$350');
  });
  test('sub-cent value -> ~<$0.01, never ~$0', () => {
    expect(fmtUsdValue('0.000001', 1)).toBe('~<$0.01');
  });
  test('zero amount -> null', () => {
    expect(fmtUsdValue('0', 3500)).toBeNull();
  });
  test('< $1 keeps more precision', () => {
    expect(fmtUsdValue('0.0001', 3500)).toBe('~$0.35');
  });
});
