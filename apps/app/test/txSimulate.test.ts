
import { describe, expect, test } from 'bun:test';
import {
  parseAssetChanges, formatAmount, humanizeRevert, insufficientEthReason, decodeRevert,
} from '../lib/txSimulate.parse';

const BASE = 8453;
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const ME = '0x20FE51A9229EEf2cF8Ad9E89d91CAb9312cF3b7A';
const PEER = '0x0000000000000000000000000000000000000abc';
const TRANSFER =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

const topic = (a: string) => '0x' + a.toLowerCase().replace(/^0x/, '').padStart(64, '0');
const u256 = (n: bigint) => '0x' + n.toString(16).padStart(64, '0');

describe('formatAmount', () => {
  test('scales by decimals and trims zeros', () => {
    expect(formatAmount(1_000_000n, 6)).toBe('1');
    expect(formatAmount(1_500_000n, 6)).toBe('1.5');
    expect(formatAmount(0n, 18)).toBe('0');
  });
});

describe('humanizeRevert', () => {
  test('insufficient funds -> ETH for value + gas', () => {
    expect(humanizeRevert('err: insufficient funds for gas * price + value')).toBe('insufficient ETH for value + gas');
  });
  test('ERC-20 transfer exceeds balance -> insufficient token balance', () => {
    expect(humanizeRevert('ERC20: transfer amount exceeds balance')).toBe('insufficient token balance');
  });
  test('allowance -> approve first', () => {
    expect(humanizeRevert('ERC20: insufficient allowance')).toBe('insufficient token allowance (approve first)');
  });
  test('bare execution reverted -> generic', () => {
    expect(humanizeRevert('execution reverted')).toBe('transaction would revert');
  });
  test('custom string reason passes through', () => {
    expect(humanizeRevert('Sale not active')).toBe('Sale not active');
  });
});

describe('decodeRevert', () => {
  test('Error(string) payload decodes + humanizes', () => {
    const reason = 'ERC20: transfer amount exceeds balance';
    const len = reason.length;
    const hex = Buffer.from(reason, 'utf8').toString('hex').padEnd(64, '0');
    const data = '0x08c379a0'
      + (32).toString(16).padStart(64, '0')
      + len.toString(16).padStart(64, '0')
      + hex;
    expect(decodeRevert(data)).toBe('insufficient token balance');
  });
});

describe('insufficientEthReason', () => {
  test('have/need formatted with the native symbol', () => {
    const r = insufficientEthReason(0n, 10n ** 17n, BASE);
    expect(r).toBe('insufficient ETH (have 0, need 0.1)');
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
    const { out } = parseAssetChanges(calls, ME, BASE, '0xde0b6b3a7640000');
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
