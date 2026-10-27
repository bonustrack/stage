import { describe, expect, test } from 'bun:test';
import { tokenRowModel, type TokenRowFormat } from '../components/wallet/screen/model';

const fmt: TokenRowFormat = {
  fmtUsd: (v, maxFrac = 2) => `$${v.toFixed(maxFrac)}`,
  fmtBalance: (v) => `~${v}`,
};

describe('tokenRowModel', () => {
  test('priced token maps value, price and change text', () => {
    const p = tokenRowModel({
      symbol: 'ETH',
      name: 'Ethereum',
      balance: '2',
      priceUsd: 2000,
      change24h: 1.5,
      logoUrl: 'logo.png',
    }, fmt);
    expect(p).toEqual({
      title: 'Ethereum',
      subtitle: '$2000.00',
      detail: '~2 ETH',
      amount: '$4000.00',
      change: '+1.50%',
      logoUri: 'logo.png',
    });
  });

  test('sub-dollar price uses four fraction digits', () => {
    const p = tokenRowModel({
      symbol: 'X', name: 'X', balance: '1',
      priceUsd: 0.1234, change24h: -2.345, logoUrl: 'l',
    }, fmt);
    expect(p.subtitle).toBe('$0.1234');
    expect(p.change).toBe('-2.35%');
  });

  test('an unpriced token falls back to its symbol and shows no value or change', () => {
    const p = tokenRowModel({
      symbol: 'TEST', name: 'Test', balance: '5',
      priceUsd: null, change24h: null, logoUrl: 'l',
    }, fmt);
    expect(p.subtitle).toBe('TEST');
    expect(p.amount).toBe('');
    expect(p.change).toBe('');
  });

  test('an unpriced zero balance shows a zero value', () => {
    const p = tokenRowModel({
      symbol: 'ETH', name: 'Ethereum', balance: '0',
      priceUsd: null, change24h: null, logoUrl: 'l',
    }, fmt);
    expect(p.amount).toBe(fmt.fmtUsd(0));
  });
});
