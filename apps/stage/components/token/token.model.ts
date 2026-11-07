import type { AssetRow } from '@stage-labs/client/wallet/assets';
import { fmtBalance, fmtUsd } from '@stage-labs/client/wallet/format';
import { stampTokenUrl } from '@stage-labs/kit/avatar';

export type TokenRowAsset = Pick<AssetRow, 'symbol' | 'name' | 'balance' | 'priceUsd' | 'change24h'>;

export type TokenRowLayout = 'wallet' | 'picker';

const TOKEN_LOGO_PX = 32;

export function tokenLogoOf(r: Pick<AssetRow, 'chainId' | 'logoAddress'>): string {
  return stampTokenUrl(r.chainId, r.logoAddress, TOKEN_LOGO_PX);
}

export interface TokenRowFields {
  title: string;
  subtitle: string;
  amount: string;
  detail: string;
  change: string;
}

export function tokenPriceText(r: Pick<TokenRowAsset, 'priceUsd' | 'symbol'>): string {
  return r.priceUsd === null ? r.symbol : fmtUsd(r.priceUsd, r.priceUsd < 1 ? 4 : 2);
}

export function tokenChangeText(change24h: number | null): string {
  return change24h === null ? '' : `${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%`;
}

function walletValueText(r: TokenRowAsset): string {
  if (r.priceUsd !== null) return fmtUsd(r.priceUsd * Number(r.balance));
  return Number(r.balance) === 0 ? fmtUsd(0) : '';
}

export function tokenRowModel(r: TokenRowAsset, layout: TokenRowLayout): TokenRowFields {
  const price = tokenPriceText(r);
  const change = tokenChangeText(r.change24h);
  const balance = `${fmtBalance(r.balance)} ${r.symbol}`;
  if (layout === 'picker') return { title: r.symbol, subtitle: price, detail: price, amount: balance, change };
  return { title: r.name, subtitle: price, detail: balance, amount: walletValueText(r), change };
}
