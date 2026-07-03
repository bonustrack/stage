
import { describe, expect, test } from 'bun:test';
import { parseUnits } from 'viem';
import { parseAmount } from '../lib/txAmount';

describe('parseAmount', () => {
  test('parses plain decimal strings to base units', () => {
    expect(parseAmount('1', 18)).toBe(parseUnits('1', 18));
    expect(parseAmount('0.05', 18)).toBe(parseUnits('0.05', 18));
    expect(parseAmount('1.5', 6)).toBe(parseUnits('1.5', 6));
  });

  test('handles high-precision / tiny values exactly (no float rounding)', () => {
    expect(parseAmount('0.000000000000000001', 18)).toBe(1n);
    expect(parseAmount('123456789.123456789', 18)).toBe(parseUnits('123456789.123456789', 18));
  });

  test('trims surrounding whitespace', () => {
    expect(parseAmount('  1.0  ', 18)).toBe(parseUnits('1.0', 18));
  });

  test('rejects scientific notation that Number() would accept', () => {
    expect(() => parseAmount('1e3', 18)).toThrow('Invalid amount');
    expect(() => parseAmount('1E-3', 18)).toThrow('Invalid amount');
  });

  test('rejects non-positive amounts', () => {
    expect(() => parseAmount('0', 18)).toThrow('Invalid amount');
    expect(() => parseAmount('0.0', 18)).toThrow('Invalid amount');
    expect(() => parseAmount('-1', 18)).toThrow('Invalid amount');
  });

  test('rejects junk / NaN / empty', () => {
    expect(() => parseAmount('', 18)).toThrow('Invalid amount');
    expect(() => parseAmount('abc', 18)).toThrow('Invalid amount');
    expect(() => parseAmount('1.2.3', 18)).toThrow('Invalid amount');
    expect(() => parseAmount('0x1', 18)).toThrow('Invalid amount');
  });

  test('rejects more fraction digits than token decimals', () => {
    expect(() => parseAmount('1.1234567', 6)).toThrow('Invalid amount');
  });
});
