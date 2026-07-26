import { describe, expect, it } from 'bun:test';
import { isAddress, parseUnits, formatUnits } from 'viem';
import {
  buildPublicTransfer, parseSendAmount, looksLikeEns,
  classifyRecipientInput, noAddressSetError, publicSendFee,
} from '../src/wallet/send';

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

describe('classifyRecipientInput equivalence with old inline branch', () => {
  function oldBranch(raw: string): { resolved: string | null; resolving: boolean; ens: string | null } {
    const q = raw.trim();
    if (!q) return { resolved: null, resolving: false, ens: null };
    if (isAddress(q)) return { resolved: q.toLowerCase(), resolving: false, ens: null };
    if (!looksLikeEns(q)) return { resolved: null, resolving: false, ens: null };
    return { resolved: null, resolving: true, ens: q.toLowerCase() };
  }
  function newBranch(raw: string): { resolved: string | null; resolving: boolean; ens: string | null } {
    const c = classifyRecipientInput(raw);
    if (c.kind === 'empty' || c.kind === 'invalid') return { resolved: null, resolving: false, ens: null };
    if (c.kind === 'address') return { resolved: c.resolved, resolving: false, ens: null };
    return { resolved: null, resolving: true, ens: c.query };
  }
  const cases = ['', '   ', RCPT, RCPT.toUpperCase(), 'Vitalik.eth', '  sub.name.ETH ', 'not-an-address', '0x1234'];
  for (const raw of cases) {
    it(`matches for ${JSON.stringify(raw)}`, () => {
      expect(newBranch(raw)).toEqual(oldBranch(raw));
    });
  }
});

describe('noAddressSetError', () => {
  it('preserves original-case query', () => {
    expect(noAddressSetError('Vitalik.eth')).toBe('No address set for Vitalik.eth');
  });
});

describe('publicSendFee equivalence with old fee math', () => {
  function oldFee(gas: bigint, maxFeePerGas?: bigint, gasPrice?: bigint): { feeWei: bigint; feeEth: string } {
    const perGas = maxFeePerGas ?? gasPrice ?? 0n;
    const feeWei = gas * perGas;
    return { feeWei, feeEth: formatUnits(feeWei, 18) };
  }
  const cases: [bigint, bigint?, bigint?][] = [
    [21000n, 30_000_000_000n, undefined],
    [50000n, undefined, 12_000_000_000n],
    [21000n, undefined, undefined],
    [0n, 5n, 9n],
  ];
  for (const [gas, mfpg, gp] of cases) {
    it(`matches gas=${gas} mfpg=${mfpg} gp=${gp}`, () => {
      expect(publicSendFee({ gas, maxFeePerGas: mfpg ?? null, gasPrice: gp ?? null }))
        .toEqual(oldFee(gas, mfpg, gp));
    });
  }
});
