import type { ColNode, ListViewItemNode } from '@stage-labs/kit/chatkit';
import { WALLET_ADDRESS_COPY, WALLET_ADDRESS_SHARE } from '../actions';
import { caption, col, icon, text } from '../primitives';

export interface AddressCardParams {
  label: string;
  address: string;
  hint?: string;
  copyType?: string;
  shareType?: string;
  copyPayload?: Record<string, unknown>;
  sharePayload?: Record<string, unknown>;
}

export function addressCopyRow(params: AddressCardParams): ListViewItemNode {
  const item: ListViewItemNode = {
    type: 'ListViewItem',
    align: 'center',
    gap: 12,
    children: [
      col([text(params.address || '—', { size: 'md', truncate: true })], { flex: 1 }),
      icon('copy', { color: 'secondary', size: 'sm' }),
    ],
  };
  item.onClickAction = {
    type: params.copyType ?? WALLET_ADDRESS_COPY,
    payload: { address: params.address, ...params.copyPayload },
  };
  return item;
}

export function addressCard(params: AddressCardParams): ColNode {
  const header = caption(params.label.toUpperCase(), { color: 'secondary', size: 'sm' });
  const children = [header, addressShareRow(params)];
  if (params.hint !== undefined) {
    children.push(caption(params.hint, { color: 'secondary', textAlign: 'center' }));
  }
  return col(children, { gap: 8 });
}

function addressShareRow(params: AddressCardParams): ListViewItemNode {
  const item = addressCopyRow(params);
  if (params.shareType !== undefined) {
    item.children.push(icon('share', { color: 'secondary', size: 'sm' }));
  }
  return item;
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
