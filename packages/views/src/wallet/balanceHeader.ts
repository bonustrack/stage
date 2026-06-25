import type { ColNode, ThemeColor, WidgetNode } from '@stage-labs/kit/kit';
import { compactList } from '../node';

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
  const heroSize = params.heroSize ?? '5xl';
  const actions = params.actions ?? [];
  const heroChildren = compactList<WidgetNode>([
    { type: 'Title', value: params.total, weight: 'semibold', size: heroSize },
    params.totalDecimals !== undefined
      ? {
          type: 'Title',
          value: params.totalDecimals,
          weight: 'semibold',
          size: heroSize,
          color: 'secondary',
        }
      : undefined,
  ]);
  const children = compactList<WidgetNode>([
    { type: 'Row', align: 'end', children: heroChildren },
    params.subtitle !== undefined
      ? { type: 'Caption', value: params.subtitle, color: 'secondary' }
      : undefined,
    actions.length > 0
      ? {
          type: 'Row',
          gap: 12,
          justify: 'start',
          children: actions.map((a) => ({
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
          })),
        }
      : undefined,
  ]);
  return { type: 'Col', gap: 12, children };
}
