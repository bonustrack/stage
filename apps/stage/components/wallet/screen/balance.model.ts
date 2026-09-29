import { fmtUsd, splitUsd } from '@stage-labs/client/wallet/format';

export type BalanceCurrency = 'USD' | 'ETH' | 'BTC';
export type BalancePrices = Partial<Record<'ethereum' | 'bitcoin', { usd: number }>>;

export function balanceCurrency(raw: string): BalanceCurrency | undefined {
  return raw === 'USD' || raw === 'ETH' || raw === 'BTC' ? raw : undefined;
}

export function nextBalanceCurrency(currency: BalanceCurrency): BalanceCurrency {
  return currency === 'USD' ? 'ETH' : currency === 'ETH' ? 'BTC' : 'USD';
}

export function isValidUsdPrice(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function balanceValue(totalUsd: number | null, currency: BalanceCurrency, prices: BalancePrices | undefined): number | null {
  if (totalUsd === null || !Number.isFinite(totalUsd) || totalUsd < 0) return null;
  if (currency === 'USD') return totalUsd;
  const price = prices?.[currency === 'ETH' ? 'ethereum' : 'bitcoin']?.usd;
  if (!isValidUsdPrice(price)) return null;
  const value = totalUsd / price;
  return Number.isFinite(value) ? value : null;
}

export interface BalanceDisplayInput {
  totalUsd: number | null;
  currency: BalanceCurrency;
  prices?: BalancePrices;
  loading: boolean;
  error: boolean;
  refreshing: boolean;
  pricesLoading: boolean;
}

function balanceStatus(input: BalanceDisplayInput, value: number | null): string | undefined {
  if (input.error) return input.loading ? 'Couldn’t load balances' : 'Couldn’t refresh balances';
  if (input.loading) return 'Loading balances…';
  if (input.totalUsd === null) return 'Some token prices are unavailable';
  if (value === null) return input.pricesLoading ? 'Loading price…' : `${input.currency} price unavailable`;
  if (input.refreshing) return 'Updating balances…';
  return undefined;
}

function balanceParts(value: number, currency: BalanceCurrency): { int: string; dec: string } {
  if (currency === 'USD') return splitUsd(fmtUsd(value));
  const digits = currency === 'ETH' ? 6 : 8;
  const minimum = 10 ** -digits;
  const formatted = value.toLocaleString('en', { maximumFractionDigits: digits });
  return splitUsd(value > 0 && value < minimum ? `<${minimum.toFixed(digits)}` : formatted);
}

export function walletBalanceDisplay(input: BalanceDisplayInput): {
  total: string; decimals: string; unit: string; subtitle?: string;
} {
  const value = balanceValue(input.totalUsd, input.currency, input.prices);
  const parts = value === null ? { int: '…', dec: '' } : balanceParts(value, input.currency);
  return {
    total: parts.int,
    decimals: parts.dec,
    unit: input.currency === 'USD' ? '' : ` ${input.currency}`,
    subtitle: balanceStatus(input, value),
  };
}
