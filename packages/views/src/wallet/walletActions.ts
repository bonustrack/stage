import type { RowNode, ThemeColor } from '@stage-labs/kit/kit';
import view from './walletActions.json';
import { buildView } from '../buildView';

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
  return (buildView(view, {
    gap: params.gap ?? 12,
    actions: params.actions.map((a) => ({
      label: a.label,
      icon: a.icon,
      pressType: a.pressType,
      bg: a.bg,
      payload: a.payload ?? {},
    })),
  }) as RowNode);
}
