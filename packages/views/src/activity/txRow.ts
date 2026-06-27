import type { IconNode, RowNode, TextNode, WidgetNode } from '@stage-labs/kit/kit';
import { compact, compactList } from '../node';
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

export function txRow(params: TxRowParams): RowNode {
  const amountLabel =
    params.amount === '0'
      ? '—'
      : `${valuePrefix(params.direction)}${params.amount} ${params.token}`;
  const icon = compact<IconNode>({
    type: 'Icon',
    name: DIR_ICON[params.direction],
    color: params.failed === true ? DANGER_COLOR : undefined,
    size: 'sm',
  });
  const amountColor = params.failed === true
    ? DANGER_COLOR
    : params.direction === 'in'
      ? SUCCESS_COLOR
      : undefined;
  const amountText = compact<TextNode>({
    type: 'Text',
    value: amountLabel,
    weight: 'semibold',
    textAlign: 'end',
    color: amountColor,
  });
  const metaChildren = compactList<WidgetNode>([
    params.chainLabel !== undefined
      ? {
          type: 'Badge',
          label: params.chainLabel,
          color: 'secondary',
          variant: 'soft',
          size: 'sm',
        }
      : undefined,
    {
      type: 'Caption',
      value: params.counterparty,
      color: 'secondary',
      truncate: true,
    },
  ]);
  return {
    type: 'Row',
    align: 'center',
    gap: 12,
    children: [
      icon,
      {
        type: 'Col',
        gap: 2,
        flex: 1,
        children: [
          {
            type: 'Text',
            value: params.title,
            weight: 'semibold',
            color: 'link',
            truncate: true,
          },
          { type: 'Row', align: 'center', gap: 6, flex: 1, children: metaChildren },
        ],
      },
      {
        type: 'Col',
        gap: 2,
        align: 'end',
        children: [
          amountText,
          {
            type: 'Caption',
            value: params.subText ?? params.timestamp,
            color: params.failed === true ? 'danger' : 'secondary',
            textAlign: 'end',
          },
        ],
      },
    ],
  };
}
