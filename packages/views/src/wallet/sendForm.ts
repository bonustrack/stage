import type {
  ListViewItemNode,
  ListViewNode,
  SelectOption,
  WidgetNode,
} from '@stage-labs/kit/chatkit';
import { WALLET_SEND_SUBMIT } from '../actions';
import { button, caption, col, text } from '../primitives';

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

function reviewRowItem(r: SendReviewRow): ListViewItemNode {
  return {
    type: 'ListViewItem',
    align: 'center',
    gap: 12,
    children: [
      col([text(r.label, { size: 'md', color: 'secondary' })], { flex: 1 }),
      text(r.value, { size: 'md', truncate: true }),
    ],
  };
}

export function sendReviewList(rows: SendReviewRow[]): ListViewNode {
  return { type: 'ListView', children: rows.map(reviewRowItem) };
}

export function sendForm(params: SendFormParams): WidgetNode {
  const children: WidgetNode[] = [
    caption('RECIPIENT', { color: 'secondary', size: 'sm' }),
    {
      type: 'Input',
      name: params.recipientName,
      defaultValue: params.recipientValue,
      placeholder: params.recipientPlaceholder ?? 'Address, ENS, or 0zk',
    },
    caption('AMOUNT', { color: 'secondary', size: 'sm' }),
    {
      type: 'Input',
      name: params.amountName,
      inputType: 'number',
      defaultValue: params.amountValue,
      placeholder: params.amountPlaceholder ?? '0',
    },
  ];
  if (params.tokenName !== undefined && params.tokenOptions !== undefined) {
    children.push(
      caption('TOKEN', { color: 'secondary', size: 'sm' }),
      {
        type: 'Select',
        name: params.tokenName,
        options: params.tokenOptions,
        defaultValue: params.tokenValue,
      },
    );
  }
  if (params.reviewRows && params.reviewRows.length > 0) {
    children.push(sendReviewList(params.reviewRows));
  }
  children.push(
    button({
      label: params.submitLabel,
      submit: true,
      block: true,
      color: 'primary',
      disabled: params.submitDisabled,
      onClickAction: { type: params.submitType ?? WALLET_SEND_SUBMIT, payload: {} },
    }),
  );
  return {
    type: 'Form',
    direction: 'col',
    gap: 8,
    onSubmitAction: { type: params.submitType ?? WALLET_SEND_SUBMIT, payload: {} },
    children,
  };
}
