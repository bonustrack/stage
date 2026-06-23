import { describe, expect, it } from 'bun:test';
import { parseUnits } from 'viem';
import { buildPublicTransfer, parseSendAmount, looksLikeEns } from '../src/wallet/send';

const ETH = { address: null, decimals: 18 } as const;
const USDC = { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 } as const;
const RCPT = '0x1111111111111111111111111111111111111111';

describe('parseSendAmount', () => {
  it('parses decimals', () => {
    expect(parseSendAmount('1.5', 18)).toBe(parseUnits('1.5', 18));
  });
  it('rejects zero and non-numeric and over-precision', () => {
    expect(() => parseSendAmount('0', 18)).toThrow();
    expect(() => parseSendAmount('abc', 18)).toThrow();
    expect(() => parseSendAmount('1.1234567', 6)).toThrow();
  });
});

describe('looksLikeEns', () => {
  it('matches .eth names and rejects addresses', () => {
    expect(looksLikeEns('vitalik.eth')).toBe(true);
    expect(looksLikeEns('sub.name.eth')).toBe(true);
    expect(looksLikeEns(RCPT)).toBe(false);
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
