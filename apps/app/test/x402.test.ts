/** Tests for the x402 display helpers used by the in-chat x402 payment card.
 *  These format atomic-unit amounts + network ids that the link-preview proxy
 *  surfaces from an HTTP 402 challenge, so they must stay precise (no float
 *  rounding on token amounts) and degrade gracefully on unknown assets/networks. */

import { describe, expect, test } from 'bun:test';

import {
  formatAtomic,
  x402AmountLabel,
  x402NetworkLabel,
  x402ChainNumber,
  x402AssetForAvatar,
} from '../lib/x402';
import type { X402Accept } from '../lib/useLinkPreview';
import {
  NETWORK_LOGO,
  BASE_NETWORK_LOGO,
  MAINNET_NETWORK_LOGO,
} from '@stage-labs/client/wallet/assets';

const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

function accept(over: Partial<X402Accept> = {}): X402Accept {
  return { scheme: 'exact', network: 'eip155:8453', ...over };
}

describe('formatAtomic', () => {
  test('formats USDC atomic (6dp) and trims trailing zeros', () => {
    expect(formatAtomic('10000', 6)).toBe('0.01');
    expect(formatAtomic('1000000', 6)).toBe('1');
    expect(formatAtomic('1500000', 6)).toBe('1.5');
  });
  test('groups large integer parts with thousands separators', () => {
    expect(formatAtomic('1234567000000', 6)).toBe('1,234,567');
  });
  test('decimals=0 returns the raw integer; junk returns undefined', () => {
    expect(formatAtomic('42', 0)).toBe('42');
    expect(formatAtomic('1.5', 6)).toBeUndefined();
    expect(formatAtomic('abc', 6)).toBeUndefined();
  });
});

describe('x402AmountLabel', () => {
  test('known USDC asset -> formatted amount + symbol', () => {
    expect(x402AmountLabel(accept({ asset: USDC_BASE, amount: '10000' }))).toBe('0.01 USDC');
  });
  test('unknown asset falls back to raw amount + extra.name hint', () => {
    expect(
      x402AmountLabel(accept({ amount: '5', extra: { name: 'FOO' } })),
    ).toBe('5 FOO');
  });
  test('unknown asset, no hint -> raw atomic amount', () => {
    expect(x402AmountLabel(accept({ amount: '5' }))).toBe('5');
  });
  test('no amount -> undefined', () => {
    expect(x402AmountLabel(accept())).toBeUndefined();
  });
});

describe('network helpers', () => {
  test('labels CAIP-2 + legacy names, falls back to raw', () => {
    expect(x402NetworkLabel('eip155:8453')).toBe('Base');
    expect(x402NetworkLabel('base')).toBe('Base');
    expect(x402NetworkLabel('eip155:84532')).toBe('Base Sepolia');
    expect(x402NetworkLabel('eip155:999999')).toBe('eip155:999999');
  });
  test('chain number from known + parsed eip155 + default', () => {
    expect(x402ChainNumber('base')).toBe(8453);
    expect(x402ChainNumber('eip155:10')).toBe(10);
    expect(x402ChainNumber('eip155:777')).toBe(777);
    expect(x402ChainNumber('weird')).toBe(1);
  });
  test('network badge logo: Base + Base Sepolia use the Base mark, not mainnet', () => {
    // The x402 card overlays NETWORK_LOGO[chainId] on the token avatar. Base
    // (8453) and Base Sepolia (84532, where the x402.org/protected demo runs)
    // must both resolve to the Base logo - regression for the demo showing the
    // Ethereum mainnet badge when the challenge network was Base Sepolia.
    expect(NETWORK_LOGO[x402ChainNumber('base')]).toBe(BASE_NETWORK_LOGO);
    expect(NETWORK_LOGO[x402ChainNumber('eip155:8453')]).toBe(BASE_NETWORK_LOGO);
    expect(NETWORK_LOGO[x402ChainNumber('base-sepolia')]).toBe(BASE_NETWORK_LOGO);
    expect(NETWORK_LOGO[x402ChainNumber('eip155:84532')]).toBe(BASE_NETWORK_LOGO);
    expect(BASE_NETWORK_LOGO).not.toBe(MAINNET_NETWORK_LOGO);
  });
  test('asset-for-avatar falls back to zero sentinel', () => {
    expect(x402AssetForAvatar(accept())).toMatch(/^0x0+$/);
    expect(x402AssetForAvatar(accept({ asset: USDC_BASE }))).toBe(USDC_BASE);
  });
});
