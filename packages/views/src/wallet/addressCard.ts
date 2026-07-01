import type { ColNode, ListViewItemNode, WidgetNode } from '@stage-labs/kit/kit';
import { compactList } from '../node';
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

function copyRow(params: AddressCardParams, hasShare: boolean): ListViewItemNode {
  const children = compactList<WidgetNode>([
    {
      type: 'Col',
      flex: 1,
      children: [
        {
          type: 'Text',
          value: params.address || '—',
          size: 'md',
          truncate: true,
        },
      ],
    },
    { type: 'Icon', name: 'copy', color: 'secondary', size: 'sm' },
    hasShare
      ? { type: 'Icon', name: 'share', color: 'secondary', size: 'sm' }
      : undefined,
  ]);
  return {
    type: 'ListViewItem',
    onClickAction: {
      type: params.copyType ?? WALLET_ADDRESS_COPY,
      payload: { address: params.address, ...params.copyPayload },
    },
    align: 'center',
    gap: 12,
    children,
  };
}

export function addressCopyRow(params: AddressCardParams): ListViewItemNode {
  return copyRow(params, false);
}

export function addressCard(params: AddressCardParams): ColNode {
  const hasShare = params.shareType !== undefined;
  const children = compactList<WidgetNode>([
    {
      type: 'Caption',
      value: params.label.toUpperCase(),
      color: 'secondary',
      size: 'sm',
    },
    copyRow(params, hasShare),
    params.hint !== undefined
      ? {
          type: 'Caption',
          value: params.hint,
          color: 'secondary',
          textAlign: 'center',
        }
      : undefined,
  ]);
  return { type: 'Col', gap: 8, children };
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
