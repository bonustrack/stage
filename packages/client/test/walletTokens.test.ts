import { describe, expect, test } from 'bun:test';
import { WALLET_ASSETS, type AssetRow } from '../src/wallet/assets';
import { tokenRowId } from '../src/wallet/tokens';

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

describe('wallet assets', () => {
  test('the wallet holds ETH then USDC, both on Base, nothing else', () => {
    expect(WALLET_ASSETS.map(a => `${a.chainId}:${a.symbol}`)).toEqual(['8453:ETH', '8453:USDC']);
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
    const ids = rows.map(tokenRowId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
