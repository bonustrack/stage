import type { RowNode, ThemeColor } from '@stage-labs/kit/kit';
import view from './txRow.json';
import { buildView } from '../buildView';
import { DANGER_COLOR, SUCCESS_COLOR } from '../colors';

export type TxDirection = 'in' | 'out' | 'self';

export interface TxRowParams {
  direction: TxDirection;
  title: string;
  amount: string;
  token: string;
  timestamp: string;
  counterparty: string;
  chainLabel?: string;
  subText?: string;
  failed?: boolean;
}

const DIR_ICON: Record<TxDirection, string> = {
  in: 'arrow-down',
  out: 'arrow-up',
  self: 'switch-horizontal',
};

function valuePrefix(direction: TxDirection): string {
  if (direction === 'in') return '+';
  if (direction === 'out') return '−';
  return '';
}

function valueColor(params: TxRowParams): ThemeColor | undefined {
  if (params.failed) return DANGER_COLOR;
  if (params.direction === 'in') return SUCCESS_COLOR;
  return undefined;
}

export function txRow(params: TxRowParams): RowNode {
  const amountLabel =
    params.amount === '0'
      ? '—'
      : `${valuePrefix(params.direction)}${params.amount} ${params.token}`;
  return (buildView(view, {
    title: params.title,
    counterparty: params.counterparty,
    chainLabel: params.chainLabel,
    dirIcon: DIR_ICON[params.direction],
    iconColor: params.failed ? DANGER_COLOR : undefined,
    amountLabel,
    amountColor: valueColor(params),
    subValue: params.subText ?? params.timestamp,
    subColor: params.failed ? 'danger' : 'secondary',
  }) as RowNode);
}
