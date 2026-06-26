import type { BasicNode, ThemeColor, WidgetNode } from '@stage-labs/kit/kit';
import { compactList } from '../node';
import { walletActions, type WalletActionButton } from './walletActions';

export interface TokenDetailCardParams {
  logoSrc: string;
  networkLogo: string;
  networkLabel: string;
  name: string;
  balanceLabel: string;
  usdLabel: string;
  borderColor: string | ThemeColor;
  bgColor: string | ThemeColor;
  actions: WalletActionButton[];
  actionsGap?: number;
  actionsPadTop: number;
  isPrivate?: boolean;
  privateIconColor?: string | ThemeColor;
  nameRowMarginTop?: number;
  balanceMarginTop?: number;
}

function tokenAvatar(
  logoSrc: string,
  networkLogo: string,
  borderColor: string | ThemeColor,
  bgColor: string | ThemeColor,
): WidgetNode {
  return {
    type: 'Stack',
    width: 72,
    height: 72,
    children: [
      {
        type: 'Image',
        src: logoSrc,
        size: 72,
        radius: 'full',
        background: borderColor,
      },
      {
        type: 'Box',
        position: 'absolute',
        right: -2,
        bottom: -2,
        width: 30,
        height: 30,
        radius: 'full',
        background: borderColor,
        border: { size: 3, color: bgColor },
        children: [
          {
            type: 'Image',
            src: networkLogo,
            fit: 'cover',
            width: '100%',
            height: '100%',
            radius: 'full',
          },
        ],
      },
    ],
  };
}

export function tokenDetailCard(params: TokenDetailCardParams): BasicNode {
  const {
    logoSrc,
    networkLogo,
    networkLabel,
    name,
    balanceLabel,
    usdLabel,
    borderColor,
    bgColor,
    actions,
    actionsGap,
    actionsPadTop,
    isPrivate,
    privateIconColor,
    nameRowMarginTop,
    balanceMarginTop,
  } = params;

  const nameTitle: WidgetNode = {
    type: 'Title',
    value: name,
    size: '5xl',
    weight: 'semibold',
    color: 'link',
  };

  const nameNode: WidgetNode =
    nameRowMarginTop !== undefined || isPrivate
      ? {
          type: 'Row',
          align: 'center',
          gap: 6,
          ...(nameRowMarginTop !== undefined
            ? { margin: { top: nameRowMarginTop } }
            : {}),
          children: compactList<WidgetNode>([
            isPrivate && privateIconColor !== undefined
              ? {
                  type: 'Icon',
                  name: 'eyeOff',
                  color: privateIconColor,
                  size: 'md',
                }
              : undefined,
            nameTitle,
          ]),
        }
      : nameTitle;

  const balanceTitle: WidgetNode = {
    type: 'Title',
    value: balanceLabel,
    size: '6xl',
    weight: 'semibold',
    color: 'link',
    ...(balanceMarginTop !== undefined ? { margin: { top: balanceMarginTop } } : {}),
  };

  return {
    type: 'Basic',
    children: [
      {
        type: 'Col',
        align: 'start',
        gap: 6,
        children: [
          tokenAvatar(logoSrc, networkLogo, borderColor, bgColor),
          nameNode,
          {
            type: 'Box',
            radius: 'full',
            padding: { x: 10, y: 3 },
            border: { size: 1, color: borderColor },
            children: [
              {
                type: 'Caption',
                value: networkLabel,
                color: 'secondary',
                size: 'sm',
              },
            ],
          },
          balanceTitle,
          { type: 'Text', value: usdLabel, size: 'md', color: 'secondary' },
          {
            type: 'Box',
            padding: { top: actionsPadTop },
            children: [walletActions({ gap: actionsGap ?? 36, actions })],
          },
        ],
      },
    ],
  };
}
