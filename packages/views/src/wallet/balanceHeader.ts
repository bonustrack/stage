import type { ColNode, ThemeColor } from '@stage-labs/kit/kit';
import view from './balanceHeader.json';
import { buildView } from '../buildView';

export interface BalanceAction {
  label: string;
  icon: string;
  pressType: string;
  bg: string | ThemeColor;
  payload?: Record<string, unknown>;
}

export interface BalanceHeaderParams {
  total: string;
  totalDecimals?: string;
  subtitle?: string;
  heroSize?: string;
  actions?: BalanceAction[];
}

export function balanceHeader(params: BalanceHeaderParams): ColNode {
  return (buildView(view, {
    total: params.total,
    totalDecimals: params.totalDecimals,
    subtitle: params.subtitle,
    heroSize: params.heroSize ?? '5xl',
    actions: (params.actions ?? []).map((a) => ({
      label: a.label,
      icon: a.icon,
      pressType: a.pressType,
      bg: a.bg,
      payload: a.payload ?? {},
    })),
    hasActions:
      params.actions !== undefined && params.actions.length > 0
        ? true
        : undefined,
  }) as ColNode);
}
