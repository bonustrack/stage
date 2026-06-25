import type { ColNode } from '@stage-labs/kit/kit';
import view from './sendFields.json';
import { buildView } from '../buildView';
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

export function sendFields(params: SendFieldsParams): ColNode {
  return (buildView(view, {
    recipient: params.recipient,
    recipientPlaceholder: params.recipientPlaceholder ?? '0x… or name.eth',
    resolving: params.resolving === true ? true : undefined,
    resolvedText: params.resolvedText,
    recipientError: params.recipientError,
    amount: params.amount,
    unitLabel: params.unitLabel,
    secondaryLabel: params.secondaryLabel,
    amountError: params.amountError,
    balanceLabel: params.balanceLabel,
    maxDisabled: params.maxDisabled,
    dangerColor: DANGER_COLOR,
    fieldChange: params.fieldChangeType ?? WALLET_SEND_FIELD_CHANGE,
    fieldAction: params.fieldActionType ?? WALLET_SEND_FIELD_ACTION,
  }) as ColNode);
}
