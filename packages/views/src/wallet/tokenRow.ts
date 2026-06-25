import type { ListViewItemNode, WidgetNode } from '@stage-labs/kit/kit';
import { WALLET_TOKEN_PRESS } from '../actions';
import { changeColor } from '../colors';
import { badge, caption, col, icon, image, row, text } from '../primitives';

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

function avatarNode(params: TokenRowParams): WidgetNode | undefined {
  if (params.showAvatar === false) return undefined;
  if (params.chainBadgeUri) {
    return col([
      image(params.logoUri, { size: 40, radius: 'full' }),
      image(params.chainBadgeUri, { size: 16, radius: 'full' }),
    ]);
  }
  return image(params.logoUri, { size: 40, radius: 'full' });
}

function identityNode(params: TokenRowParams): WidgetNode {
  const heading = row(
    [
      ...(params.isPrivate
        ? [icon('shield-check', { color: 'secondary', size: 'sm' })]
        : []),
      text(params.symbol, { weight: 'semibold', truncate: true }),
    ],
    { align: 'center', gap: 6 },
  );
  return col([heading, caption(params.name, { color: 'secondary' })], { gap: 2 });
}

function numbersNode(params: TokenRowParams): WidgetNode {
  return col(
    [
      text(params.balance, { weight: 'semibold', textAlign: 'end' }),
      row(
        [
          caption(params.priceUsd, { color: 'secondary' }),
          badge(params.change24h, {
            variant: 'soft',
            size: 'sm',
            color: params.change24h.trim().startsWith('-') ? 'danger' : 'success',
          }),
        ],
        { gap: 4, justify: 'end', align: 'center' },
      ),
    ],
    { gap: 2, align: 'end' },
  );
}

export function tokenRowBody(params: TokenRowParams): WidgetNode {
  const avatar = avatarNode(params);
  const children: WidgetNode[] = [
    ...(avatar ? [avatar] : []),
    identityNode(params),
    { type: 'Spacer' },
    numbersNode(params),
    ...(params.trailingChevron === false
      ? []
      : [icon('chevron-right', { color: changeColor(params.change24h), size: 'sm' })]),
  ];
  return row(children, { align: 'center', gap: 12, flex: 1 });
}

export function tokenRow(params: TokenRowParams): ListViewItemNode {
  return {
    type: 'ListViewItem',
    onClickAction: {
      type: WALLET_TOKEN_PRESS,
      payload: { tokenId: params.tokenId },
    },
    align: 'center',
    gap: 12,
    children: [tokenRowBody(params)],
  };
}
