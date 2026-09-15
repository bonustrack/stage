import { describe, expect, test } from 'bun:test';
import type { AssetRow } from '@stage-labs/client/wallet/assets';
import {
  buildSortedTokenRows,
  tokenRowId,
} from '../components/tabs/WalletScreen.sort';

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
