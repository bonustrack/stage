import type {
  ListViewItemNode,
  ListViewNode,
  SelectOption,
  WidgetNode,
} from '@stage-labs/kit/kit';
import { compact, compactList } from '../node';
import { WALLET_SEND_SUBMIT } from '../actions';

export interface SendReviewRow {
  label: string;
  value: string;
}

export interface SendFormParams {
  recipientName: string;
  recipientValue?: string;
  recipientPlaceholder?: string;
  amountName: string;
  amountValue?: string;
  amountPlaceholder?: string;
  tokenName?: string;
  tokenOptions?: SelectOption[];
  tokenValue?: string;
  reviewRows?: SendReviewRow[];
  submitLabel: string;
  submitType?: string;
  submitDisabled?: boolean;
}

function reviewItem(row: SendReviewRow): ListViewItemNode {
  return {
    type: 'ListViewItem',
    align: 'center',
    gap: 12,
    children: [
      {
        type: 'Col',
        flex: 1,
        children: [{ type: 'Text', value: row.label, size: 'md', color: 'secondary' }],
      },
      { type: 'Text', value: row.value, size: 'md', truncate: true },
    ],
  };
}

export function sendReviewList(rows: SendReviewRow[]): ListViewNode {
  return { type: 'ListView', children: rows.map(reviewItem) };
}

function tokenCaption(hasToken: boolean): WidgetNode | undefined {
  if (!hasToken) return undefined;
  return { type: 'Caption', value: 'TOKEN', color: 'secondary', size: 'sm' };
}

function tokenSelect(
  params: SendFormParams,
  hasToken: boolean,
): WidgetNode | undefined {
  if (!hasToken) return undefined;
  return compact({
    type: 'Select' as const,
    name: params.tokenName ?? '',
    options: params.tokenOptions ?? [],
    defaultValue: params.tokenValue,
  });
}

function reviewList(rows: SendReviewRow[]): WidgetNode | undefined {
  if (rows.length === 0) return undefined;
  return { type: 'ListView', children: rows.map(reviewItem) };
}

export function sendForm(params: SendFormParams): WidgetNode {
  const submitAction = params.submitType ?? WALLET_SEND_SUBMIT;
  const hasToken =
    params.tokenName !== undefined && params.tokenOptions !== undefined;
  const children = compactList<WidgetNode>([
    { type: 'Caption', value: 'RECIPIENT', color: 'secondary', size: 'sm' },
    compact({
      type: 'Input' as const,
      name: params.recipientName,
      defaultValue: params.recipientValue,
      placeholder: params.recipientPlaceholder ?? 'Address, ENS, or 0zk',
    }),
    { type: 'Caption', value: 'AMOUNT', color: 'secondary', size: 'sm' },
    compact({
      type: 'Input' as const,
      name: params.amountName,
      inputType: 'number' as const,
      defaultValue: params.amountValue,
      placeholder: params.amountPlaceholder ?? '0',
    }),
    tokenCaption(hasToken),
    tokenSelect(params, hasToken),
    reviewList(params.reviewRows ?? []),
    compact({
      type: 'Button' as const,
      label: params.submitLabel,
      submit: true,
      block: true,
      color: 'primary' as const,
      disabled: params.submitDisabled,
      onClickAction: { type: submitAction, payload: {} },
    }),
  ]);
  return {
    type: 'Form',
    direction: 'col',
    gap: 8,
    onSubmitAction: { type: submitAction, payload: {} },
    children,
  };
}
