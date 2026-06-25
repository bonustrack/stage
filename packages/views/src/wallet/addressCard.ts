import type { ColNode, ListViewItemNode } from '@stage-labs/kit/kit';
import copyRowView from './addressCopyRow.json';
import cardView from './addressCard.json';
import { buildView } from '../buildView';
import { WALLET_ADDRESS_COPY, WALLET_ADDRESS_SHARE } from '../actions';

export interface AddressCardParams {
  label: string;
  address: string;
  hint?: string;
  copyType?: string;
  shareType?: string;
  copyPayload?: Record<string, unknown>;
  sharePayload?: Record<string, unknown>;
}

function copyScope(params: AddressCardParams): Record<string, unknown> {
  return {
    copyAction: params.copyType ?? WALLET_ADDRESS_COPY,
    copyPayload: { address: params.address, ...params.copyPayload },
    addressDisplay: params.address || '—',
  };
}

export function addressCopyRow(params: AddressCardParams): ListViewItemNode {
  return (buildView(copyRowView, copyScope(params)) as ListViewItemNode);
}

export function addressCard(params: AddressCardParams): ColNode {
  return (buildView(cardView, {
    ...copyScope(params),
    labelUpper: params.label.toUpperCase(),
    hasShare: params.shareType !== undefined || undefined,
    hint: params.hint,
  }) as ColNode);
}

export function addressShareAction(params: AddressCardParams): {
  type: string;
  payload: Record<string, unknown>;
} {
  return {
    type: params.shareType ?? WALLET_ADDRESS_SHARE,
    payload: { address: params.address, ...params.sharePayload },
  };
}
