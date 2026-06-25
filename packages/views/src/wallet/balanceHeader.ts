import type { ColNode } from '@stage-labs/kit/kit';
import view from './balanceHeader.json';
import { buildView } from '../buildView';

export interface BalanceAction {
  label: string;
  icon: string;
  pressType: string;
  payload?: Record<string, unknown>;
}

export interface BalanceHeaderParams {
  total: string;
  totalDecimals?: string;
  subtitle?: string;
  actions?: BalanceAction[];
}

export function balanceHeader(params: BalanceHeaderParams): ColNode {
  return (buildView(view, {
    total: params.total,
    totalDecimals: params.totalDecimals,
    subtitle: params.subtitle,
    actions: params.actions ?? [],
    hasActions:
      params.actions !== undefined && params.actions.length > 0
        ? true
        : undefined,
  }) as ColNode);
}
