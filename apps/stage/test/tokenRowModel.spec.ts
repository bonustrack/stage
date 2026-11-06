import { describe, expect, test } from 'bun:test';
import { tokenRowModel } from '../components/token/token.model';

const ETH = { symbol: 'ETH', name: 'Ethereum', balance: '2', priceUsd: 2000, change24h: 1.5 };

describe('tokenRowModel', () => {
  test('a priced wallet row maps value, price and change text', () => {
    expect(tokenRowModel(ETH, 'wallet')).toEqual({
      title: 'Ethereum',
      subtitle: '$2,000.00',
      detail: '2 ETH',
      amount: '$4,000.00',
      change: '+1.50%',
    });
  });

  test('a picker row leads with the symbol and shows the balance as its amount', () => {
    expect(tokenRowModel(ETH, 'picker')).toEqual({
      title: 'ETH',
      subtitle: '$2,000.00',
      detail: '$2,000.00',
      amount: '2 ETH',
      change: '+1.50%',
    });
  });

  test('sub-dollar price uses four fraction digits', () => {
    const p = tokenRowModel({ symbol: 'X', name: 'X', balance: '1', priceUsd: 0.1234, change24h: -2.345 }, 'wallet');
    expect(p.subtitle).toBe('$0.1234');
    expect(p.change).toBe('-2.35%');
  });

  test('an unpriced token falls back to its symbol and shows no value or change', () => {
    const p = tokenRowModel({ symbol: 'TEST', name: 'Test', balance: '5', priceUsd: null, change24h: null }, 'wallet');
    expect(p.subtitle).toBe('TEST');
    expect(p.amount).toBe('');
    expect(p.change).toBe('');
  });

  test('an unpriced zero balance shows a zero value', () => {
    const p = tokenRowModel({ symbol: 'ETH', name: 'Ethereum', balance: '0', priceUsd: null, change24h: null }, 'wallet');
    expect(p.amount).toBe('$0.00');
  });
});
