import { describe, expect, test } from 'bun:test';
import {
  fallbackSendToken,
  listedNativeChains,
  listedSendableRows,
  sendableOnAccount,
} from '../components/wallet/TokenSelector.model';

const rows = [{ chainId: 1, symbol: 'ETH' }, { chainId: 8453, symbol: 'ETH' }, { chainId: 11155111, symbol: 'ETH' }];

const emptyWallet = [
  { chainId: 1, symbol: 'ETH', balance: '0' },
  { chainId: 1, symbol: 'USDC', balance: '0' },
  { chainId: 11155111, symbol: 'ETH', balance: '0' },
  { chainId: 11155111, symbol: 'STAGE', balance: '0' },
  { chainId: 8453, symbol: 'ETH', balance: '0' },
  { chainId: 8453, symbol: 'USDC', balance: '0' },
];

function ids(list: { chainId: number; symbol: string }[]): string[] {
  return list.map(r => `${r.chainId}:${r.symbol}`);
}

describe('sendableOnAccount', () => {
  test('a smart account only offers tokens on Base, the one chain it can send on', () => {
    expect(sendableOnAccount(rows, true).map(r => r.chainId)).toEqual([8453]);
  });

  test('a key-based account keeps every chain', () => {
    expect(sendableOnAccount(rows, false)).toEqual(rows);
  });
});

describe('listedNativeChains', () => {
  test('a smart account always lists the native token on Base only', () => {
    expect(listedNativeChains(true)).toEqual([8453]);
  });

  test('a key-based account lists the native token of every supported chain', () => {
    expect(listedNativeChains(false)).toEqual([1, 11155111, 8453]);
  });
});

describe('listedSendableRows', () => {
  test('an empty smart account still offers ETH on Base at zero', () => {
    expect(ids(listedSendableRows(emptyWallet, true))).toEqual(['8453:ETH']);
  });

  test('an empty key account offers native ETH on every chain and hides zero tokens', () => {
    expect(ids(listedSendableRows(emptyWallet, false))).toEqual(['1:ETH', '11155111:ETH', '8453:ETH']);
  });

  test('funded non-native tokens are listed next to the native rows', () => {
    const funded = emptyWallet.map(r => (r.chainId === 8453 && r.symbol === 'USDC' ? { ...r, balance: '5' } : r));
    expect(ids(listedSendableRows(funded, true))).toEqual(['8453:ETH', '8453:USDC']);
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
