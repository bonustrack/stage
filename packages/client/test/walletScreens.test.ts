import { describe, expect, it } from 'bun:test';
import { tokenAmountFromInput, toggleAmountUnit } from '../src/wallet/sendAmount';

describe('sendAmount', () => {
  it('an empty, non-numeric or non-positive amount is no amount', () => {
    for (const amount of ['', '  ', 'abc', '0', '-1', 'Infinity']) {
      expect(tokenAmountFromInput(amount, 'primary', 100)).toBe(0);
      expect(toggleAmountUnit(amount, 'primary', 100)).toEqual({ amount, unit: 'usd' });
    }
    expect(tokenAmountFromInput(' 1.5 ', 'primary', 100)).toBe(1.5);
  });

  it('tokenAmountFromInput converts only in usd unit with price', () => {
    expect(tokenAmountFromInput('2', 'primary', 100)).toBe(2);
    expect(tokenAmountFromInput('200', 'usd', 100)).toBe(2);
    expect(tokenAmountFromInput('200', 'usd', null)).toBe(0);
    expect(tokenAmountFromInput('', 'usd', 100)).toBe(0);
  });

  it('toggleAmountUnit flips unit only when amount/price missing', () => {
    expect(toggleAmountUnit('', 'primary', 100)).toEqual({ amount: '', unit: 'usd' });
    expect(toggleAmountUnit('1', 'primary', null)).toEqual({ amount: '1', unit: 'usd' });
    expect(toggleAmountUnit('0', 'usd', 100)).toEqual({ amount: '0', unit: 'primary' });
  });

  it('toggleAmountUnit converts primary->usd with toFixed(2)', () => {
    expect(toggleAmountUnit('2', 'primary', 1234.5)).toEqual({ amount: '2469.00', unit: 'usd' });
  });

  it('toggleAmountUnit converts usd->primary trimming trailing zeros', () => {
    expect(toggleAmountUnit('100', 'usd', 4)).toEqual({ amount: '25', unit: 'primary' });
    expect(toggleAmountUnit('1', 'usd', 4)).toEqual({ amount: '0.25', unit: 'primary' });
    expect(toggleAmountUnit('1', 'usd', 3)).toEqual({ amount: '0.333333', unit: 'primary' });
  });
});
