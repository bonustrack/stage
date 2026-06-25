import type { ListViewItemNode, WidgetNode } from '@stage-labs/kit/kit';
import { ACCOUNT_PRESS } from '../actions';

export interface AccountRowParams {
  accountId: string;
  avatarUri: string;
  name: string;
  address: string;
  typeLabel?: string;
}

export function accountRow(params: AccountRowParams): ListViewItemNode {
  const inner: WidgetNode[] = [
    { type: 'Image', src: params.avatarUri, size: 40, radius: 'full' },
    {
      type: 'Col',
      gap: 2,
      flex: 1,
      children: [
        { type: 'Text', value: params.name, weight: 'semibold', truncate: true },
        {
          type: 'Caption',
          value: params.address,
          color: 'secondary',
          truncate: true,
        },
      ],
    },
  ];
  if (params.typeLabel !== undefined) {
    inner.push({
      type: 'Badge',
      label: params.typeLabel,
      color: 'secondary',
      variant: 'soft',
      size: 'sm',
    });
  }
  return {
    type: 'ListViewItem',
    onClickAction: {
      type: ACCOUNT_PRESS,
      payload: { accountId: params.accountId },
    },
    align: 'center',
    gap: 12,
    children: [{ type: 'Row', align: 'center', gap: 12, flex: 1, children: inner }],
  };
}
