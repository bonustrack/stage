/** Tests for the pre-sign simulation parse logic (lib/txSimulate). Pure log →
 *  asset-delta math (no RPC): given eth_simulateV1 call results, parseAssetChanges
 *  nets ERC-20 + native Transfer logs relative to the sender into in/out lists. */

import { describe, expect, test } from 'bun:test';
import { parseAssetChanges, formatAmount } from '../lib/txSimulate.parse';

const BASE = 8453;
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // 6 decimals on Base
const ME = '0x20FE51A9229EEf2cF8Ad9E89d91CAb9312cF3b7A';
const PEER = '0x0000000000000000000000000000000000000abc';
const TRANSFER =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

/** 32-byte left-padded address topic. */
const topic = (a: string) => '0x' + a.toLowerCase().replace(/^0x/, '').padStart(64, '0');
/** 32-byte uint data. */
const u256 = (n: bigint) => '0x' + n.toString(16).padStart(64, '0');

describe('formatAmount', () => {
  test('scales by decimals and trims zeros', () => {
    expect(formatAmount(1_000_000n, 6)).toBe('1'); // 1 USDC
    expect(formatAmount(1_500_000n, 6)).toBe('1.5');
    expect(formatAmount(0n, 18)).toBe('0');
  });
});

describe('parseAssetChanges', () => {
  test('ERC-20 transfer OUT -> out: N USDC', () => {
    const calls = [{
      status: '0x1',
      logs: [{
        address: USDC,
        topics: [TRANSFER, topic(ME), topic(PEER)],
        data: u256(1_000_000n),
      }],
    }];
    const { in: inc, out } = parseAssetChanges(calls, ME, BASE);
    expect(inc).toHaveLength(0);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ symbol: 'USDC', amount: '1', decimals: 6 });
  });

  test('ERC-20 transfer IN -> in: N USDC', () => {
    const calls = [{
      status: '0x1',
      logs: [{
        address: USDC,
        topics: [TRANSFER, topic(PEER), topic(ME)],
        data: u256(2_500_000n),
      }],
    }];
    const { in: inc, out } = parseAssetChanges(calls, ME, BASE);
    expect(out).toHaveLength(0);
    expect(inc[0]).toMatchObject({ symbol: 'USDC', amount: '2.5' });
  });

  test('no transfer logs -> no balance changes (e.g. a Poster post)', () => {
    const calls = [{ status: '0x1', logs: [] }];
    const { in: inc, out } = parseAssetChanges(calls, ME, BASE);
    expect(inc).toHaveLength(0);
    expect(out).toHaveLength(0);
  });

  test('plain native send folds top-level value as ETH OUT', () => {
    const calls = [{ status: '0x1', logs: [] }];
    const { out } = parseAssetChanges(calls, ME, BASE, '0xde0b6b3a7640000'); // 1 ETH
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ symbol: 'ETH', amount: '1', decimals: 18 });
  });

  test('unknown token falls back to short address + 18 decimals', () => {
    const UNK = '0x1111111111111111111111111111111111111111';
    const calls = [{
      status: '0x1',
      logs: [{ address: UNK, topics: [TRANSFER, topic(ME), topic(PEER)], data: u256(10n ** 18n) }],
    }];
    const { out } = parseAssetChanges(calls, ME, BASE);
    expect(out[0].symbol).toContain('…');
    expect(out[0].amount).toBe('1');
  });
});
