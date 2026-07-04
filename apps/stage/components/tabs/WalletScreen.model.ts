import type { TabsOption } from '@stage-labs/kit/kit';

export interface WalletScreenFeatures {
  privateTab?: boolean;
}

export function walletTabOptions(features: WalletScreenFeatures = {}): TabsOption[] {
  const options: TabsOption[] = [
    { value: 'tokens', label: 'Tokens' },
    { value: 'nfts', label: 'NFTs' },
    { value: 'activity', label: 'Activity' },
  ];
  if (features.privateTab === true) options.push({ value: 'private', label: 'Railgun' });
  return options;
}

export interface WalletTotalRow {
  priceUsd: number | null;
  balance: string;
}

export function walletTotalUsd(rows: readonly WalletTotalRow[] | null): number | null {
  if (rows === null) return null;
  return rows.reduce((s, r) => s + (r.priceUsd ?? 0) * Number(r.balance), 0);
}

export interface WalletBalanceHeroModel {
  parts: { int: string; dec: string } | null;
  error: boolean;
}

export interface WalletHeroDisplay {
  total: string;
  totalDecimals?: string;
  subtitle?: string;
}

export function walletHeroDisplay(m: WalletBalanceHeroModel): WalletHeroDisplay {
  const parts = m.error ? null : m.parts;
  return {
    total: parts ? parts.int : '…',
    totalDecimals: parts ? parts.dec : undefined,
    subtitle: m.error ? 'Couldn’t load balances' : undefined,
  };
}

export interface TokenRowAsset {
  chainId: number;
  symbol: string;
  name: string;
  balance: string;
  priceUsd: number | null;
  change24h: number | null;
  logoUrl: string;
  isPrivate?: boolean;
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
  isPrivate?: boolean;
}

export function tokenRowModel(r: TokenRowAsset, f: TokenRowFormat): TokenRowModelParams {
  const valueUsd = r.priceUsd === null ? null : r.priceUsd * Number(r.balance);
  const priceText = r.priceUsd === null ? r.symbol : f.fmtUsd(r.priceUsd, r.priceUsd < 1 ? 4 : 2);
  const changeText =
    r.change24h === null ? '' : `${r.change24h >= 0 ? '+' : ''}${r.change24h.toFixed(2)}%`;
  return {
    tokenId: `${r.chainId}:${r.symbol}`,
    symbol: r.name,
    name: priceText,
    priceUsd: `${f.fmtBalance(r.balance)} ${r.symbol}`,
    balance: valueUsd === null ? '—' : f.fmtUsd(valueUsd),
    change24h: changeText,
    logoUri: r.logoUrl,
    isPrivate: r.isPrivate,
  };
}
