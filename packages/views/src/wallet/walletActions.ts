import type { RowNode, ThemeColor, WidgetNode } from '@stage-labs/kit/kit';

export interface WalletActionButton {
  label: string;
  icon: string;
  pressType: string;
  bg: string | ThemeColor;
  payload?: Record<string, unknown>;
}

export interface WalletActionsParams {
  actions: WalletActionButton[];
  gap?: number;
}

export function walletActions(params: WalletActionsParams): RowNode {
  const children = params.actions.map((a): WidgetNode => ({
    type: 'Col',
    gap: 6,
    align: 'center',
    children: [
      {
        type: 'Button',
        uniform: true,
        pill: true,
        size: 'xl',
        iconStart: a.icon,
        iconSize: 'xl',
        color: a.bg,
        background: a.bg,
        onClickAction: { type: a.pressType, payload: a.payload ?? {} },
      },
      { type: 'Caption', value: a.label, weight: 'semibold' },
    ],
  }));
  return { type: 'Row', gap: params.gap ?? 12, justify: 'start', children };
}
