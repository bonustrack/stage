
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
    isPrivate: p.isPrivate,
  };
}

describe('buildSortedTokenRows', () => {
  test('ranks merged rows by USD value descending', () => {
    const pub = [
      row({ symbol: 'A', balance: '1', priceUsd: 10 }),
      row({ symbol: 'B', balance: '2', priceUsd: 100 }),
    ];
    const priv = [
      row({ symbol: 'C', balance: '5', priceUsd: 20, isPrivate: true }),
    ];
    const out = buildSortedTokenRows(pub, priv).map(x => x.r.symbol);
    expect(out).toEqual(['B', 'C', 'A']);
  });

  test('a high-value private token can outrank a low-value public one', () => {
    const pub = [row({ symbol: 'PUB', balance: '1', priceUsd: 5 })];
    const priv = [row({ symbol: 'PRIV', balance: '1', priceUsd: 5000, isPrivate: true })];
    const out = buildSortedTokenRows(pub, priv).map(x => x.r.symbol);
    expect(out).toEqual(['PRIV', 'PUB']);
  });

  test('drops zero / non-positive balance rows (public and shielded)', () => {
    const pub = [
      row({ symbol: 'KEEP', balance: '1', priceUsd: 1 }),
      row({ symbol: 'ZERO', balance: '0', priceUsd: 999 }),
    ];
    const priv = [row({ symbol: 'PZERO', balance: '0', priceUsd: 999, isPrivate: true })];
    const out = buildSortedTokenRows(pub, priv).map(x => x.r.symbol);
    expect(out).toEqual(['KEEP']);
  });

  test('stable sort: equal-value rows keep public-then-private order', () => {
    const pub = [
      row({ symbol: 'P1', balance: '1' }),
      row({ symbol: 'P2', balance: '1' }),
    ];
    const priv = [
      row({ symbol: 'S1', balance: '1', isPrivate: true }),
      row({ symbol: 'S2', balance: '1', isPrivate: true }),
    ];
    const out = buildSortedTokenRows(pub, priv).map(x => x.r.symbol);
    expect(out).toEqual(['P1', 'P2', 'S1', 'S2']);
  });

  test('does not mutate the input arrays', () => {
    const pub = [row({ symbol: 'A', balance: '1', priceUsd: 1 })];
    const priv = [row({ symbol: 'B', balance: '2', priceUsd: 1, isPrivate: true })];
    buildSortedTokenRows(pub, priv);
    expect(pub.map(r => r.symbol)).toEqual(['A']);
    expect(priv.map(r => r.symbol)).toEqual(['B']);
  });

  test('passes input row objects through by reference (memo-safety invariant)', () => {
    const pub = [
      row({ symbol: 'A', balance: '1', priceUsd: 10 }),
      row({ symbol: 'B', balance: '2', priceUsd: 100 }),
    ];
    const priv = [row({ symbol: 'C', balance: '5', priceUsd: 20, isPrivate: true })];
    const out = buildSortedTokenRows(pub, priv);
    const inputs = new Set<AssetRow>([...pub, ...priv]);
    for (const { r } of out) expect(inputs.has(r)).toBe(true);
    const again = buildSortedTokenRows(pub, priv);
    expect(again.map(x => x.r)).toEqual(out.map(x => x.r));
  });
});

describe('tokenRowId', () => {
  test('encodes privacy, chain and symbol; pub vs priv differ', () => {
    const pub = row({ symbol: 'USDC', chainId: 1, balance: '1' });
    const priv = row({ symbol: 'USDC', chainId: 1, balance: '1', isPrivate: true });
    expect(tokenRowId(pub)).toBe('pub:1:USDC');
    expect(tokenRowId(priv)).toBe('priv:1:USDC');
    expect(tokenRowId(pub)).not.toBe(tokenRowId(priv));
  });

  test('ids are unique across a mixed list (safe as React keys)', () => {
    const pub = [
      row({ symbol: 'USDC', chainId: 1, balance: '1', priceUsd: 1 }),
      row({ symbol: 'USDC', chainId: 137, balance: '1', priceUsd: 1 }),
    ];
    const priv = [row({ symbol: 'USDC', chainId: 1, balance: '1', priceUsd: 1, isPrivate: true })];
    const ids = buildSortedTokenRows(pub, priv).map(x => x.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
