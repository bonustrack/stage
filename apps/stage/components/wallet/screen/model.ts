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

export interface TokenRowAsset {
  chainId: number;
  symbol: string;
  name: string;
  balance: string;
  priceUsd: number | null;
  change24h: number | null;
  logoUrl: string;
}

export interface TokenRowFormat {
  fmtUsd: (v: number, maxFrac?: number) => string;
  fmtBalance: (v: string) => string;
}

export interface TokenRowModelParams {
  tokenId: string;
  symbol: string;
  name: string;
  priceUsd: string;
  balance: string;
  change24h: string;
  logoUri: string;
}

export function tokenPriceText(r: Pick<TokenRowAsset, 'priceUsd' | 'symbol'>, fmtUsd: TokenRowFormat['fmtUsd']): string {
  return r.priceUsd === null ? r.symbol : fmtUsd(r.priceUsd, r.priceUsd < 1 ? 4 : 2);
}

export function tokenChangeText(change24h: number | null): string {
  return change24h === null ? '' : `${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%`;
}

export function tokenRowModel(r: TokenRowAsset, f: TokenRowFormat): TokenRowModelParams {
  const valueUsd = r.priceUsd === null ? null : r.priceUsd * Number(r.balance);
  const priceText = tokenPriceText(r, f.fmtUsd);
  const changeText = tokenChangeText(r.change24h);
  return {
    tokenId: `${r.chainId}:${r.symbol}`,
    symbol: r.name,
    name: priceText,
    priceUsd: `${f.fmtBalance(r.balance)} ${r.symbol}`,
    balance: valueUsd !== null ? f.fmtUsd(valueUsd) : Number(r.balance) === 0 ? f.fmtUsd(0) : '',
    change24h: changeText,
    logoUri: r.logoUrl,
  };
}
