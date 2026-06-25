import type {
  ListViewNode,
  SelectOption,
  WidgetNode,
} from '@stage-labs/kit/kit';
import view from './sendForm.json';
import reviewListView from './sendReviewList.json';
import { buildView } from '../buildView';
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

export function sendReviewList(rows: SendReviewRow[]): ListViewNode {
  return (buildView(reviewListView, { rows }) as ListViewNode);
}

export function sendForm(params: SendFormParams): WidgetNode {
  const hasToken =
    params.tokenName !== undefined && params.tokenOptions !== undefined;
  return buildView(view, {
    submitAction: params.submitType ?? WALLET_SEND_SUBMIT,
    recipientName: params.recipientName,
    recipientValue: params.recipientValue,
    recipientPlaceholder: params.recipientPlaceholder ?? 'Address, ENS, or 0zk',
    amountName: params.amountName,
    amountValue: params.amountValue,
    amountPlaceholder: params.amountPlaceholder ?? '0',
    hasToken: hasToken || undefined,
    tokenName: params.tokenName,
    tokenOptions: params.tokenOptions,
    tokenValue: params.tokenValue,
    hasReview:
      params.reviewRows !== undefined && params.reviewRows.length > 0
        ? true
        : undefined,
    reviewRows: params.reviewRows ?? [],
    submitLabel: params.submitLabel,
    submitDisabled: params.submitDisabled,
  });
}
