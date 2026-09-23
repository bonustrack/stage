import { describe, expect, test } from 'bun:test';
import { fallbackSendToken, sendableOnAccount } from '../components/wallet/TokenSelector.model';

const rows = [{ chainId: 1, symbol: 'ETH' }, { chainId: 8453, symbol: 'ETH' }, { chainId: 11155111, symbol: 'ETH' }];

describe('sendableOnAccount', () => {
  test('a smart account only offers tokens on Base, the one chain it can send on', () => {
    expect(sendableOnAccount(rows, true).map(r => r.chainId)).toEqual([8453]);
  });

  test('a key-based account keeps every chain', () => {
    expect(sendableOnAccount(rows, false)).toEqual(rows);
  });
});

describe('fallbackSendToken', () => {
  test('a smart account with nothing to send defaults to ETH on Base', () => {
    expect(fallbackSendToken(true)).toEqual({ symbol: 'ETH', chainId: 8453 });
  });

  test('a key account keeps ETH on Ethereum', () => {
    expect(fallbackSendToken(false)).toEqual({ symbol: 'ETH', chainId: 1 });
  });
});
