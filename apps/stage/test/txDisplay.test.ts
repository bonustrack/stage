
import { describe, expect, test } from 'bun:test';
import { tokenLogoUrl } from '../lib/txDisplay';

const SEPOLIA = 11155111;
const BASE = 8453;
const NATIVE = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const STAGE = '0x7a49F33AD000220a764ED303f9911cB08422d138';
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
