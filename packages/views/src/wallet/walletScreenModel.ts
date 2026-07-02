import type { TabsOption, ThemeColor, WidgetRoot } from '@stage-labs/kit/kit';
import { basicRoot } from '../primitives';
import { WALLET_ACTION_PRESS } from '../actions';
import { balanceHeader, type BalanceAction } from './balanceHeader';

export interface WalletScreenFeatures {
  privateTab?: boolean;
  swapBuy?: boolean;
  errorSubtitle?: boolean;
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

function walletHeroActions(
  bg: string | ThemeColor,
  features: WalletScreenFeatures,
): BalanceAction[] {
  const mk = (label: string, icon: string, action: string): BalanceAction => ({
    label,
    icon,
    pressType: WALLET_ACTION_PRESS,
    bg,
    payload: { action },
  });
  const actions = [mk('Send', 'send', 'send'), mk('Receive', 'arrowDown', 'receive')];
  if (features.swapBuy === true) {
    actions.push(mk('Swap', 'switchHorizontal', 'swap'), mk('Buy', 'creditCard', 'buy'));
  }
  return actions;
}

export interface WalletBalanceHeroModel {
  parts: { int: string; dec: string } | null;
  error: boolean;
}

export function walletBalanceHeroNode(
  m: WalletBalanceHeroModel,
  bg: string | ThemeColor,
  features: WalletScreenFeatures = {},
): WidgetRoot {
  const parts = m.error ? null : m.parts;
  return basicRoot(
    balanceHeader({
      total: parts ? parts.int : '…',
      totalDecimals: parts ? parts.dec : undefined,
      subtitle: features.errorSubtitle === true && m.error ? 'Couldn’t load balances' : undefined,
      heroSize: '7xl',
      actions: walletHeroActions(bg, features),
    }),
  );
}
