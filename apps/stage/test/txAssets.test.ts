
import { describe, expect, test } from 'bun:test';
import { tokenLogoUrl, priceKeyFor, priceKeyId, isUnknownToken } from '../lib/txAssets';

const SEPOLIA = 11155111;
const BASE = 8453;
const NATIVE = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const STAGE = '0x7a49F33AD000220a764ED303f9911cB08422d138';
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const UNKNOWN = '0x1111111111111111111111111111111111111111';

describe('tokenLogoUrl', () => {
  test('native ETH -> the ETH sentinel logo', () => {
    const url = tokenLogoUrl(BASE, null, 36);
    expect(url).toContain(NATIVE);
  });
  test('known ERC-20 (STAGE) -> its OWN contract logo, not ETH', () => {
    const url = tokenLogoUrl(SEPOLIA, STAGE, 36);
    expect(url.toLowerCase()).toContain(STAGE.toLowerCase());
    expect(url.toLowerCase()).not.toContain(NATIVE);
  });
  test('unknown token -> its own identicon, NEVER the ETH logo', () => {
    const url = tokenLogoUrl(BASE, UNKNOWN, 36);
    expect(url.toLowerCase()).toContain(UNKNOWN);
    expect(url.toLowerCase()).not.toContain(NATIVE);
  });
});

describe('isUnknownToken', () => {
  test('native + known token are NOT unknown', () => {
    expect(isUnknownToken(BASE, null)).toBe(false);
    expect(isUnknownToken(SEPOLIA, STAGE)).toBe(false);
  });
  test('unregistered token is unknown', () => {
    expect(isUnknownToken(BASE, UNKNOWN)).toBe(true);
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
