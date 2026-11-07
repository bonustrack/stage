import { isValidUsdPrice } from './balance.model';

export interface WalletTotalRow {
  priceUsd: number | null;
  balance: string;
}

export function walletTotalUsd(rows: readonly WalletTotalRow[] | null): number | null {
  if (rows === null) return null;
  let total = 0;
  for (const row of rows) {
    const balance = Number(row.balance);
    if (!row.balance.trim() || !Number.isFinite(balance) || balance < 0) return null;
    if (balance === 0) continue;
    if (!isValidUsdPrice(row.priceUsd)) return null;
    total += row.priceUsd * balance;
  }
  return Number.isFinite(total) ? total : null;
}
