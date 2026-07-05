import type { AssetRow } from './assets';
import { fmtUsd, fmtBalance } from './format';

export interface TokenDetailViewModel {
  name: string;
  networkLabel: string;
  balanceLabel: string;
  usdLabel: string;
  valueUsd: number | null;
}

export function tokenValueUsd(row: Pick<AssetRow, 'priceUsd' | 'balance'>): number | null {
  return row.priceUsd == null ? null : row.priceUsd * Number(row.balance);
}

export interface TokenDetailViewModelOpts {
  networkLabels: Record<number, string>;
}

export function tokenDetailViewModel(
  row: Pick<AssetRow, 'name' | 'symbol' | 'chainId' | 'balance' | 'priceUsd'>,
  opts: TokenDetailViewModelOpts,
): TokenDetailViewModel {
  const valueUsd = tokenValueUsd(row);
  return {
    name: row.name,
    networkLabel: opts.networkLabels[row.chainId] ?? `Chain ${row.chainId}`,
    balanceLabel: `${fmtBalance(row.balance)} ${row.symbol}`,
    usdLabel: valueUsd === null ? '—' : fmtUsd(valueUsd),
    valueUsd,
  };
}
