import { describe, expect, test } from 'bun:test';
import { tokenRowModel, type TokenRowFormat } from '../components/tabs/WalletScreen.model';

const fmt: TokenRowFormat = {
  fmtUsd: (v, maxFrac = 2) => `$${v.toFixed(maxFrac)}`,
  fmtBalance: (v) => `~${v}`,
};

describe('tokenRowModel', () => {
  test('priced token maps value, price and change text', () => {
    const p = tokenRowModel({
      chainId: 1,
      symbol: 'ETH',
      name: 'Ethereum',
      balance: '2',
      priceUsd: 2000,
      change24h: 1.5,
      logoUrl: 'logo.png',
    }, fmt);
    expect(p).toEqual({
      tokenId: '1:ETH',
      symbol: 'Ethereum',
      name: '$2000.00',
      priceUsd: '~2 ETH',
      balance: '$4000.00',
      change24h: '+1.50%',
      logoUri: 'logo.png',
      isPrivate: undefined,
    });
  });

  test('sub-dollar price uses four fraction digits', () => {
    const p = tokenRowModel({
      chainId: 1, symbol: 'X', name: 'X', balance: '1',
      priceUsd: 0.1234, change24h: -2.345, logoUrl: 'l',
    }, fmt);
    expect(p.name).toBe('$0.1234');
    expect(p.change24h).toBe('-2.35%');
  });

  test('unpriced token falls back to symbol and em dash value', () => {
    const p = tokenRowModel({
      chainId: 11155111, symbol: 'TEST', name: 'Test', balance: '5',
      priceUsd: null, change24h: null, logoUrl: 'l', isPrivate: true,
    }, fmt);
    expect(p.name).toBe('TEST');
    expect(p.balance).toBe('—');
    expect(p.change24h).toBe('');
    expect(p.isPrivate).toBe(true);
    expect(p.tokenId).toBe('11155111:TEST');
  });
});
