import { describe, expect, it } from 'bun:test';
import { buildPublicTransfer } from '../src/wallet/send';

const ETH = { address: null, decimals: 18 } as const;
const USDC = { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 } as const;
const RCPT = '0x1111111111111111111111111111111111111111';

const ethValue = (amount: string): bigint => buildPublicTransfer({ recipient: RCPT, amount, asset: ETH }).value;
const usdcUnits = (amount: string): bigint =>
  BigInt(`0x${(buildPublicTransfer({ recipient: RCPT, amount, asset: USDC }).data ?? '').slice(-64)}`);
const ONE_ETH = 10n ** 18n;

describe('transfer amounts', () => {
  it('parses plain decimal strings to base units', () => {
    expect(ethValue('1')).toBe(ONE_ETH);
    expect(ethValue('0.05')).toBe(5n * 10n ** 16n);
    expect(usdcUnits('1.5')).toBe(1_500_000n);
  });

  it('handles high-precision / tiny values exactly (no float rounding)', () => {
    expect(ethValue('0.000000000000000001')).toBe(1n);
    expect(ethValue('123456789.123456789')).toBe(123_456_789_123_456_789_000_000_000n);
  });

  it('trims surrounding whitespace', () => {
    expect(ethValue('  1.0  ')).toBe(ONE_ETH);
  });

  it('rejects scientific notation, non-positive amounts and junk', () => {
    for (const amount of ['1e3', '1E-3', '0', '0.0', '-1', '', 'abc', '1.2.3', '0x1']) {
      expect(() => ethValue(amount)).toThrow('Invalid amount');
    }
  });

  it('rounds fraction digits past the token decimals, as the smart account send always did', () => {
    expect(usdcUnits('1.1234567')).toBe(1_123_457n);
    expect(ethValue('0.0033333333333333335')).toBe(3_333_333_333_333_334n);
  });

  it('accepts a bare leading or trailing decimal point', () => {
    expect(ethValue('.5')).toBe(5n * 10n ** 17n);
    expect(ethValue('1.')).toBe(ONE_ETH);
  });

  it('rejects an amount that rounds to zero', () => {
    expect(() => usdcUnits('0.0000001')).toThrow('Invalid amount');
  });
});

describe('buildPublicTransfer', () => {
  it('builds a native transfer', () => {
    const call = buildPublicTransfer({ recipient: RCPT, amount: '1', asset: ETH });
    expect(call.to.toLowerCase()).toBe(RCPT);
    expect(call.value).toBe(ONE_ETH);
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
