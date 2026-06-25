import type { ListViewItemNode, WidgetNode } from '@stage-labs/kit/kit';
import view from './tokenRow.json';
import { buildView } from '../buildView';
import { WALLET_TOKEN_PRESS } from '../actions';
import { changeColor } from '../colors';

export interface TokenRowParams {
  tokenId: string;
  symbol: string;
  name: string;
  priceUsd: string;
  balance: string;
  change24h: string;
  logoUri: string;
  chainBadgeUri?: string;
  isPrivate?: boolean;
  showAvatar?: boolean;
  trailingChevron?: boolean;
}

export function tokenRow(params: TokenRowParams): ListViewItemNode {
  const showAvatar = params.showAvatar !== false;
  const stacked = showAvatar && params.chainBadgeUri !== undefined;
  return (buildView(view, {
    ...params,
    action: WALLET_TOKEN_PRESS,
    avatarStacked: stacked || undefined,
    avatarPlain: (showAvatar && !stacked) || undefined,
    showChevron: params.trailingChevron !== false || undefined,
    changeBadgeColor: params.change24h.trim().startsWith('-') ? 'danger' : 'success',
    chevronColor: changeColor(params.change24h),
  }) as ListViewItemNode);
}

export function tokenRowBody(params: TokenRowParams): WidgetNode {
  const [body] = tokenRow(params).children;
  if (body === undefined) throw new Error('tokenRow body missing');
  return body;
}
