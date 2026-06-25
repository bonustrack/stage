import type { RowNode, ThemeColor } from '@stage-labs/kit/kit';
import { DANGER_COLOR, SUCCESS_COLOR } from '../colors';
import { badge, caption, col, icon, row, text } from '../primitives';

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

  const party = col(
    [
      text(params.title, { weight: 'semibold', color: 'link', truncate: true }),
      row(
        [
          ...(params.chainLabel
            ? [badge(params.chainLabel, { color: 'secondary', variant: 'soft', size: 'sm' })]
            : []),
          caption(params.counterparty, { color: 'secondary', truncate: true }),
        ],
        { align: 'center', gap: 6, flex: 1 },
      ),
    ],
    { gap: 2, flex: 1 },
  );

  const amounts = col(
    [
      text(amountLabel, { weight: 'semibold', textAlign: 'end', color: valueColor(params) }),
      caption(params.subText ?? params.timestamp, {
        color: params.failed ? 'danger' : 'secondary',
        textAlign: 'end',
      }),
    ],
    { gap: 2, align: 'end' },
  );

  return row(
    [
      icon(DIR_ICON[params.direction], {
        color: params.failed ? DANGER_COLOR : undefined,
        size: 'sm',
      }),
      party,
      amounts,
    ],
    { align: 'center', gap: 12 },
  );
}
