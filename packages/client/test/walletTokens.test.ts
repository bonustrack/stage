import { describe, expect, test } from 'bun:test';
import type { AssetRow } from '../src/wallet/assets';
import {
  buildSortedTokenRows,
  isListedTokenRow,
  isNativeTokenRow,
  nativeTokenChainIds,
  tokenRowId,
} from '../src/wallet/tokens';

function row(p: Partial<AssetRow> & { symbol: string; balance: string }): AssetRow {
  return {
    symbol: p.symbol,
    name: p.name ?? p.symbol,
    chainId: p.chainId ?? 1,
    balance: p.balance,
    priceUsd: p.priceUsd ?? null,
    change24h: p.change24h ?? null,
    logoUrl: p.logoUrl ?? '',
  };
}

describe('buildSortedTokenRows', () => {
  test('ranks rows by USD value descending', () => {
    const rows = [
      row({ symbol: 'A', balance: '1', priceUsd: 10 }),
      row({ symbol: 'B', balance: '2', priceUsd: 100 }),
      row({ symbol: 'C', balance: '5', priceUsd: 20 }),
    ];
    expect(buildSortedTokenRows(rows).map(x => x.r.symbol)).toEqual(['B', 'C', 'A']);
  });

  test('drops zero / non-positive balance rows', () => {
    const rows = [
      row({ symbol: 'KEEP', balance: '1', priceUsd: 1 }),
      row({ symbol: 'ZERO', balance: '0', priceUsd: 999 }),
    ];
    expect(buildSortedTokenRows(rows).map(x => x.r.symbol)).toEqual(['KEEP']);
  });

  test('stable sort: equal-value rows keep their input order', () => {
    const rows = [
      row({ symbol: 'P1', balance: '1' }),
      row({ symbol: 'P2', balance: '1' }),
      row({ symbol: 'P3', balance: '1' }),
    ];
    expect(buildSortedTokenRows(rows).map(x => x.r.symbol)).toEqual(['P1', 'P2', 'P3']);
  });

  test('does not mutate the input array', () => {
    const rows = [row({ symbol: 'B', balance: '2', priceUsd: 1 }), row({ symbol: 'A', balance: '1', priceUsd: 100 })];
    buildSortedTokenRows(rows);
    expect(rows.map(r => r.symbol)).toEqual(['B', 'A']);
  });

  test('passes input row objects through by reference (memo-safety invariant)', () => {
    const rows = [
      row({ symbol: 'A', balance: '1', priceUsd: 10 }),
      row({ symbol: 'B', balance: '2', priceUsd: 100 }),
    ];
    const out = buildSortedTokenRows(rows);
    const inputs = new Set<AssetRow>(rows);
    for (const { r } of out) expect(inputs.has(r)).toBe(true);
    expect(buildSortedTokenRows(rows).map(x => x.r)).toEqual(out.map(x => x.r));
  });
});

describe('native token listing', () => {
  test('recognises the native row of each supported chain', () => {
    expect(isNativeTokenRow({ chainId: 8453, symbol: 'ETH' })).toBe(true);
    expect(isNativeTokenRow({ chainId: 1, symbol: 'ETH' })).toBe(true);
    expect(isNativeTokenRow({ chainId: 8453, symbol: 'USDC' })).toBe(false);
    expect(isNativeTokenRow({ chainId: 137, symbol: 'ETH' })).toBe(false);
  });

  test('lists one native chain per supported chain', () => {
    expect(nativeTokenChainIds()).toEqual([1, 11155111, 8453]);
  });

  test('a zero native row is listed only on the given chains', () => {
    const eth = row({ symbol: 'ETH', chainId: 8453, balance: '0' });
    expect(isListedTokenRow(eth)).toBe(false);
    expect(isListedTokenRow(eth, [8453])).toBe(true);
    expect(isListedTokenRow(row({ symbol: 'ETH', chainId: 1, balance: '0' }), [8453])).toBe(false);
  });

  test('zero non-native rows stay hidden even on a native chain', () => {
    expect(isListedTokenRow(row({ symbol: 'USDC', chainId: 8453, balance: '0' }), [8453])).toBe(false);
  });

  test('sorted rows keep the zero native row after funded tokens', () => {
    const rows = [
      row({ symbol: 'ETH', chainId: 8453, balance: '0', priceUsd: 3000 }),
      row({ symbol: 'USDC', chainId: 8453, balance: '0' }),
      row({ symbol: 'USDC', chainId: 1, balance: '2', priceUsd: 1 }),
    ];
    expect(buildSortedTokenRows(rows, [8453]).map(x => x.id)).toEqual(['1:USDC', '8453:ETH']);
  });
});

describe('tokenRowId', () => {
  test('encodes chain and symbol', () => {
    expect(tokenRowId(row({ symbol: 'USDC', chainId: 1, balance: '1' }))).toBe('1:USDC');
  });

  test('ids are unique across chains (safe as React keys)', () => {
    const rows = [
      row({ symbol: 'USDC', chainId: 1, balance: '1', priceUsd: 1 }),
      row({ symbol: 'USDC', chainId: 137, balance: '1', priceUsd: 1 }),
    ];
    const ids = buildSortedTokenRows(rows).map(x => x.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
