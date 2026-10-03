import { describe, expect, test } from 'bun:test';
import { walletTotalUsd, sendTokenFor } from '../components/wallet/screen/model';
import {
  balanceCurrency, nextBalanceCurrency, walletBalanceDisplay,
  type BalanceDisplayInput,
} from '../components/wallet/screen/balance.model';

const loaded: BalanceDisplayInput = {
  totalUsd: 8000, currency: 'USD',
  prices: { ethereum: { usd: 4000 }, bitcoin: { usd: 80000 } },
  loading: false, error: false, refreshing: false, pricesLoading: false,
};

function text(input: BalanceDisplayInput): string {
  const display = walletBalanceDisplay(input);
  return `${display.total}${display.decimals}${display.unit}`;
}

describe('walletTotalUsd', () => {
  test('null rows stay null', () => {
    expect(walletTotalUsd(null)).toBeNull();
  });

  test('sums the same portfolio across all token rows', () => {
    expect(walletTotalUsd([
      { priceUsd: 2, balance: '3' },
      { priceUsd: 0.5, balance: '4' },
    ])).toBe(8);
  });

  test('zero holdings need no price, including an empty portfolio', () => {
    expect(walletTotalUsd([{ priceUsd: null, balance: '0' }])).toBe(0);
    expect(walletTotalUsd([])).toBe(0);
  });

  test.each([null, 0, -1, NaN, Infinity])('does not understate holdings with invalid price %p', (priceUsd) => {
    expect(walletTotalUsd([{ priceUsd: 2, balance: '3' }, { priceUsd, balance: '10' }])).toBeNull();
  });

  test.each(['', ' ', 'invalid', '-1', 'Infinity'])('rejects invalid balance %p', (balance) => {
    expect(walletTotalUsd([{ priceUsd: 1, balance }])).toBeNull();
  });

  test('rejects overflowing totals', () => {
    expect(walletTotalUsd([{ priceUsd: Number.MAX_VALUE, balance: '2' }])).toBeNull();
  });
});

describe('wallet display currency', () => {
  test('cycles USD to ETH to BTC to USD without changing the total', () => {
    const input = { ...loaded };
    expect(text(input)).toBe('$8,000.00');
    input.currency = nextBalanceCurrency(input.currency);
    expect(input.currency).toBe('ETH');
    expect(text(input)).toBe('2 ETH');
    input.currency = nextBalanceCurrency(input.currency);
    expect(input.currency).toBe('BTC');
    expect(text(input)).toBe('0.1 BTC');
    input.currency = nextBalanceCurrency(input.currency);
    expect(input.currency).toBe('USD');
    expect(text(input)).toBe('$8,000.00');
    expect(input.totalUsd).toBe(8000);
  });

  test('accepts only supported saved currencies', () => {
    expect(['USD', 'ETH', 'BTC', 'EUR', '', 'eth'].map(balanceCurrency)).toEqual(['USD', 'ETH', 'BTC', undefined, undefined, undefined]);
  });

  test('USD never depends on conversion quotes', () => {
    expect(text({ ...loaded, prices: undefined })).toBe('$8,000.00');
  });

  test.each(['ETH', 'BTC'] as const)('does not need a held %s token to convert', (currency) => {
    const totalUsd = walletTotalUsd([{ priceUsd: 1, balance: '8000' }]);
    expect(text({ ...loaded, totalUsd, currency })).toBe(currency === 'ETH' ? '2 ETH' : '0.1 BTC');
  });

  test.each([undefined, {}, { ethereum: { usd: 0 } }, { ethereum: { usd: -1 } }, { ethereum: { usd: NaN } }, { ethereum: { usd: Infinity } }])('hides invalid conversion prices %p', (prices) => {
    const result = walletBalanceDisplay({ ...loaded, currency: 'ETH', prices });
    expect(result.total).toBe('-');
    expect(result.subtitle).toBe('ETH price unavailable');
  });

  test('BTC does not fall back to ETH or a held wrapped token price', () => {
    expect(text({ ...loaded, currency: 'BTC', prices: { ethereum: { usd: 4000 } } })).toBe('- BTC');
  });

  test.each([null, NaN, Infinity, -1])('hides unavailable or invalid total %p', (totalUsd) => {
    expect(walletBalanceDisplay({ ...loaded, totalUsd }).total).toBe('-');
  });

  test('rejects overflowing conversion', () => {
    expect(walletBalanceDisplay({ ...loaded, currency: 'ETH', prices: { ethereum: { usd: Number.MIN_VALUE } } }).total).toBe('-');
  });

  test('formats zero, grouping, and small crypto amounts without rounding to zero', () => {
    expect(text({ ...loaded, totalUsd: 0 })).toBe('$0.00');
    expect(text({ ...loaded, totalUsd: 0, currency: 'ETH' })).toBe('0 ETH');
    expect(text({ ...loaded, totalUsd: 0, currency: 'BTC' })).toBe('0 BTC');
    expect(text({ ...loaded, totalUsd: 4_938_271.56, currency: 'ETH' })).toBe('1,234.56789 ETH');
    expect(text({ ...loaded, totalUsd: 0.0001, currency: 'ETH' })).toBe('<0.000001 ETH');
    expect(text({ ...loaded, totalUsd: 0.0001, currency: 'BTC' })).toBe('<0.00000001 BTC');
    expect(text({ ...loaded, totalUsd: 1, currency: 'BTC' })).toBe('0.0000125 BTC');
  });
});

describe('wallet loading and refresh display', () => {
  test('initial loading shows a spinner, no text and no false zero', () => {
    const display = walletBalanceDisplay({ ...loaded, totalUsd: null, loading: true });
    expect(display.spinner).toBe(true);
    expect(display.total).toBe('-');
    expect(display.subtitle).toBeUndefined();
  });

  test('initial error is explicit without a numeric balance', () => {
    const display = walletBalanceDisplay({ ...loaded, totalUsd: null, loading: true, error: true });
    expect(display.spinner).toBe(false);
    expect(display.total).toBe('-');
    expect(display.subtitle).toBe('Couldn’t load balances');
  });

  test('failed refetch preserves the last balance and labels it', () => {
    const display = walletBalanceDisplay({ ...loaded, error: true });
    expect(display.total).toBe('$8,000');
    expect(display.subtitle).toBe('Couldn’t refresh balances');
  });

  test('refetch keeps cached total without a progress caption', () => {
    const display = walletBalanceDisplay({ ...loaded, refreshing: true });
    expect(display.spinner).toBe(false);
    expect(display.total).toBe('$8,000');
    expect(display.subtitle).toBeUndefined();
  });

  test('missing held-token prices do not display an incomplete total', () => {
    expect(walletBalanceDisplay({ ...loaded, totalUsd: null }).subtitle).toBe('Some token prices are unavailable');
  });

  test('missing conversion quotes show a spinner only while fetching', () => {
    const display = walletBalanceDisplay({ ...loaded, currency: 'ETH', prices: undefined, pricesLoading: true });
    expect(display.spinner).toBe(true);
    expect(display.subtitle).toBeUndefined();
    const settled = walletBalanceDisplay({ ...loaded, currency: 'ETH', prices: undefined });
    expect(settled.spinner).toBe(false);
    expect(settled.subtitle).toBe('ETH price unavailable');
  });

  test('successful loaded balance has no status text', () => {
    expect(walletBalanceDisplay(loaded).subtitle).toBeUndefined();
    expect(walletBalanceDisplay(loaded).spinner).toBe(false);
  });
});

describe('sendTokenFor', () => {
  test('defaults to ETH on Base', () => {
    expect(sendTokenFor()).toEqual({ symbol: 'ETH', chainId: 8453 });
  });

  test('keeps USDC on Base when the link asks for it', () => {
    expect(sendTokenFor('USDC')).toEqual({ symbol: 'USDC', chainId: 8453 });
    expect(sendTokenFor('USDC', '8453')).toEqual({ symbol: 'USDC', chainId: 8453 });
  });

  test('falls back to ETH on Base for a token or chain the wallet does not hold', () => {
    expect(sendTokenFor('USDC', '1')).toEqual({ symbol: 'ETH', chainId: 8453 });
    expect(sendTokenFor('STAGE', '11155111')).toEqual({ symbol: 'ETH', chainId: 8453 });
    expect(sendTokenFor('DAI')).toEqual({ symbol: 'ETH', chainId: 8453 });
  });
});
