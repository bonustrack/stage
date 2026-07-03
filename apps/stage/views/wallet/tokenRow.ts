import type { ListViewItemNode, WidgetNode } from '@stage-labs/kit/kit';
import { compactList } from '../node';
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
  const changeBadgeColor = params.change24h.trim().startsWith('-')
    ? 'danger'
    : 'success';
  const symbolRowChildren = compactList<WidgetNode>([
    params.isPrivate === true
      ? { type: 'Icon', name: 'shield-check', color: 'secondary', size: 'sm' }
      : undefined,
    { type: 'Text', value: params.symbol, weight: 'semibold', truncate: true },
  ]);
  const rowChildren = compactList<WidgetNode>([
    stacked
      ? {
          type: 'Col',
          children: [
            { type: 'Image', src: params.logoUri, size: 40, radius: 'full' },
            { type: 'Image', src: params.chainBadgeUri ?? '', size: 16, radius: 'full' },
          ],
        }
      : undefined,
    showAvatar && !stacked
      ? { type: 'Image', src: params.logoUri, size: 40, radius: 'full' }
      : undefined,
    {
      type: 'Col',
      gap: 2,
      children: [
        { type: 'Row', align: 'center', gap: 6, children: symbolRowChildren },
        { type: 'Caption', value: params.name, color: 'secondary' },
      ],
    },
    { type: 'Spacer' },
    {
      type: 'Col',
      gap: 2,
      align: 'end',
      children: [
        { type: 'Text', value: params.balance, weight: 'semibold', textAlign: 'end' },
        {
          type: 'Row',
          gap: 4,
          justify: 'end',
          align: 'center',
          children: [
            { type: 'Caption', value: params.priceUsd, color: 'secondary' },
            {
              type: 'Badge',
              label: params.change24h,
              variant: 'soft',
              size: 'sm',
              color: changeBadgeColor,
            },
          ],
        },
      ],
    },
    params.trailingChevron !== false
      ? {
          type: 'Icon',
          name: 'chevron-right',
          color: changeColor(params.change24h),
          size: 'sm',
        }
      : undefined,
  ]);
  return {
    type: 'ListViewItem',
    onClickAction: {
      type: WALLET_TOKEN_PRESS,
      payload: { tokenId: params.tokenId },
    },
    align: 'center',
    gap: 12,
    children: [{ type: 'Row', align: 'center', gap: 12, flex: 1, children: rowChildren }],
  };
}

export function tokenRowBody(params: TokenRowParams): WidgetNode {
  const [body] = tokenRow(params).children;
  if (body === undefined) throw new Error('tokenRow body missing');
  return body;
}
