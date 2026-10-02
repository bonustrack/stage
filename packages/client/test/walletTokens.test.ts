import { describe, expect, test } from 'bun:test';
import { WALLET_ASSETS, type AssetRow } from '../src/wallet/assets';
import { priceKeyFor, priceKeyId, tokenRowId } from '../src/wallet/tokens';

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

describe('priceKeyFor', () => {
  test('native ETH -> native cgId', () => {
    expect(priceKeyFor(BASE, null)).toMatchObject({ kind: 'native', cgId: 'ethereum' });
  });
  test('USDC on Base -> erc20 on base platform', () => {
    const k = priceKeyFor(BASE, USDC_BASE);
    expect(k).toMatchObject({ kind: 'erc20', platform: 'base' });
  });
  test('STAGE (no listing) -> null (amount only, no fake $)', () => {
    expect(priceKeyFor(SEPOLIA, STAGE)).toBeNull();
  });
  test('unknown token -> null', () => {
    expect(priceKeyFor(BASE, UNKNOWN)).toBeNull();
  });
});

describe('priceKeyId', () => {
  test('stable ids for native + erc20, null for null', () => {
    expect(priceKeyId(priceKeyFor(BASE, null))).toBe('native:ethereum');
    expect(priceKeyId(priceKeyFor(BASE, USDC_BASE))).toContain('erc20:base:');
    expect(priceKeyId(null)).toBeNull();
  });
});
