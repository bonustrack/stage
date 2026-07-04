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
