export type AmountUnit = 'primary' | 'usd';

export function parsePositiveAmount(amount: string): number | null {
  const raw = typeof amount === 'string' ? amount.trim() : '';
  if (!raw) return null;
  const n = Number(raw);
  if (!isFinite(n) || n <= 0) return null;
  return n;
}

export function trimDecimalString(value: string): string {
  return value.replace(/0+$/, '').replace(/\.$/, '');
}

export function tokenAmountFromInput(
  amount: string, unit: AmountUnit, priceUsd: number | null,
): number {
  const n = parsePositiveAmount(amount);
  if (n == null) return 0;
  if (unit === 'primary') return n;
  if (!priceUsd) return 0;
  return n / priceUsd;
}

export interface ToggleAmountResult {
  amount: string;
  unit: AmountUnit;
}

export function toggleAmountUnit(
  amount: string, unit: AmountUnit, priceUsd: number | null,
): ToggleAmountResult {
  const flipped: AmountUnit = unit === 'primary' ? 'usd' : 'primary';
  const n = parsePositiveAmount(amount);
  if (n == null || !priceUsd) return { amount, unit: flipped };
  if (unit === 'primary') {
    return { amount: (n * priceUsd).toFixed(2), unit: 'usd' };
  }
  return { amount: trimDecimalString((n / priceUsd).toFixed(6)), unit: 'primary' };
}
