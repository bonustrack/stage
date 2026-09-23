import { describe, expect, it } from 'bun:test';
import { parseUnits } from 'viem';
import { buildPublicTransfer, parseSendAmount } from '../src/wallet/send';

const ETH = { address: null, decimals: 18 } as const;
const USDC = { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 } as const;
const RCPT = '0x1111111111111111111111111111111111111111';

describe('parseSendAmount', () => {
  it('parses plain decimal strings to base units', () => {
    expect(parseSendAmount('1', 18)).toBe(parseUnits('1', 18));
    expect(parseSendAmount('0.05', 18)).toBe(parseUnits('0.05', 18));
    expect(parseSendAmount('1.5', 6)).toBe(parseUnits('1.5', 6));
  });

  it('handles high-precision / tiny values exactly (no float rounding)', () => {
    expect(parseSendAmount('0.000000000000000001', 18)).toBe(1n);
    expect(parseSendAmount('123456789.123456789', 18)).toBe(parseUnits('123456789.123456789', 18));
  });

  it('trims surrounding whitespace', () => {
    expect(parseSendAmount('  1.0  ', 18)).toBe(parseUnits('1.0', 18));
  });

  it('rejects scientific notation that Number() would accept', () => {
    expect(() => parseSendAmount('1e3', 18)).toThrow('Invalid amount');
    expect(() => parseSendAmount('1E-3', 18)).toThrow('Invalid amount');
  });

  it('rejects non-positive amounts', () => {
    expect(() => parseSendAmount('0', 18)).toThrow('Invalid amount');
    expect(() => parseSendAmount('0.0', 18)).toThrow('Invalid amount');
    expect(() => parseSendAmount('-1', 18)).toThrow('Invalid amount');
  });

  it('rejects junk / NaN / empty', () => {
    expect(() => parseSendAmount('', 18)).toThrow('Invalid amount');
    expect(() => parseSendAmount('abc', 18)).toThrow('Invalid amount');
    expect(() => parseSendAmount('1.2.3', 18)).toThrow('Invalid amount');
    expect(() => parseSendAmount('0x1', 18)).toThrow('Invalid amount');
  });

  it('rejects more fraction digits than token decimals', () => {
    expect(() => parseSendAmount('1.1234567', 6)).toThrow('Invalid amount');
  });
});

describe('buildPublicTransfer', () => {
  it('builds a native transfer', () => {
    const call = buildPublicTransfer({ recipient: RCPT, amount: '1', asset: ETH });
    expect(call.to.toLowerCase()).toBe(RCPT);
    expect(call.value).toBe(parseUnits('1', 18));
    expect(call.data).toBeUndefined();
  });
  it('builds an erc20 transfer to the token with zero value', () => {
    const call = buildPublicTransfer({ recipient: RCPT, amount: '2.5', asset: USDC });
    expect(call.to).toBe(USDC.address);
    expect(call.value).toBe(0n);
    expect(call.data?.startsWith('0xa9059cbb')).toBe(true);
  });
  it('rejects invalid recipient', () => {
    expect(() => buildPublicTransfer({ recipient: 'nope', amount: '1', asset: ETH })).toThrow();
  });
  it('produces a kernel-sendable call shape (to/value/optional data only)', () => {
    const native = buildPublicTransfer({ recipient: RCPT, amount: '1', asset: ETH });
    expect(Object.keys(native).sort()).toEqual(['to', 'value']);
    const erc20 = buildPublicTransfer({ recipient: RCPT, amount: '1', asset: USDC });
    expect(Object.keys(erc20).sort()).toEqual(['data', 'to', 'value']);
  });
});
