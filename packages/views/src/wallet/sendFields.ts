import type { ColNode, WidgetNode } from '@stage-labs/kit/kit';
import { compact, compactList } from '../node';
import { DANGER_COLOR } from '../colors';
import {
  WALLET_SEND_FIELD_ACTION,
  WALLET_SEND_FIELD_CHANGE,
} from '../actions';

export interface SendFieldsParams {
  recipient: string;
  recipientPlaceholder?: string;
  resolving?: boolean;
  resolvedText?: string;
  recipientError?: string;
  amount: string;
  unitLabel: string;
  secondaryLabel?: string;
  amountError?: string;
  balanceLabel?: string;
  maxDisabled?: boolean;
  fieldChangeType?: string;
  fieldActionType?: string;
}

function captionIf(
  value: string | undefined,
  color: 'secondary' | typeof DANGER_COLOR,
): WidgetNode | undefined {
  if (value === undefined) return undefined;
  return { type: 'Caption', value, color };
}

function recipientChildrenOf(
  params: SendFieldsParams,
  fieldChange: string,
): WidgetNode[] {
  return compactList<WidgetNode>([
    { type: 'Caption', value: 'RECIPIENT', color: 'secondary', size: 'sm' },
    {
      type: 'TextField',
      name: 'recipient',
      value: params.recipient,
      placeholder: params.recipientPlaceholder ?? '0x… or name.eth',
      onChangeAction: { type: fieldChange, payload: { field: 'recipient' } },
    },
    params.resolving === true
      ? { type: 'Caption', value: 'Resolving…', color: 'secondary' }
      : undefined,
    captionIf(params.resolvedText, 'secondary'),
    captionIf(params.recipientError, DANGER_COLOR),
  ]);
}

function amountHeader(params: SendFieldsParams, fieldAction: string): WidgetNode {
  return {
    type: 'Row',
    align: 'center',
    justify: 'between',
    children: [
      { type: 'Caption', value: 'AMOUNT', color: 'secondary', size: 'sm' },
      {
        type: 'Row',
        align: 'center',
        gap: 8,
        children: [
          {
            type: 'Button',
            label: params.unitLabel,
            iconEnd: 'arrowDown',
            variant: 'soft',
            size: 'sm',
            pill: true,
            onClickAction: { type: fieldAction, payload: { action: 'toggleUnit' } },
          },
          compact({
            type: 'Button' as const,
            label: 'MAX',
            variant: 'ghost' as const,
            size: 'sm' as const,
            disabled: params.maxDisabled,
            onClickAction: { type: fieldAction, payload: { action: 'max' } },
          }),
        ],
      },
    ],
  };
}

function amountChildrenOf(
  params: SendFieldsParams,
  fieldChange: string,
  fieldAction: string,
): WidgetNode[] {
  return compactList<WidgetNode>([
    amountHeader(params, fieldAction),
    {
      type: 'TextField',
      name: 'amount',
      value: params.amount,
      placeholder: '0.0',
      onChangeAction: { type: fieldChange, payload: { field: 'amount' } },
    },
    captionIf(params.secondaryLabel, 'secondary'),
    captionIf(params.amountError, DANGER_COLOR),
    captionIf(params.balanceLabel, 'secondary'),
  ]);
}

export function sendFields(params: SendFieldsParams): ColNode {
  const fieldChange = params.fieldChangeType ?? WALLET_SEND_FIELD_CHANGE;
  const fieldAction = params.fieldActionType ?? WALLET_SEND_FIELD_ACTION;
  return {
    type: 'Col',
    gap: 16,
    children: [
      { type: 'Col', gap: 6, children: recipientChildrenOf(params, fieldChange) },
      {
        type: 'Col',
        gap: 6,
        children: amountChildrenOf(params, fieldChange, fieldAction),
      },
    ],
  };
}

