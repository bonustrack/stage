import { describe, expect, test } from 'bun:test';
import { WALLET_ASSETS, type AssetRow } from '../src/wallet/assets';
import { priceIdFor, tokenRowId } from '../src/wallet/tokens';

const SEPOLIA = 11155111;
const BASE = 8453;
const STAGE = '0x7a49F33AD000220a764ED303f9911cB08422d138';
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const UNKNOWN = '0x1111111111111111111111111111111111111111';

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

describe('priceIdFor', () => {
  test('native ETH -> DefiLlama native ETH id', () => {
    expect(priceIdFor(BASE, null)).toBe('ethereum:0x0000000000000000000000000000000000000000');
    expect(priceIdFor(SEPOLIA, null)).toBe('ethereum:0x0000000000000000000000000000000000000000');
  });
  test('USDC on Base -> DefiLlama base contract id', () => {
    expect(priceIdFor(BASE, USDC_BASE)).toBe('base:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913');
  });
  test('STAGE (no listing) -> null (amount only, no fake $)', () => {
    expect(priceIdFor(SEPOLIA, STAGE)).toBeNull();
  });
  test('unknown token -> null', () => {
    expect(priceIdFor(BASE, UNKNOWN)).toBeNull();
  });
});
