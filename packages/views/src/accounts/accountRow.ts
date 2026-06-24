import type { ListViewItemNode } from '@stage-labs/kit/chatkit';
import { ACCOUNT_PRESS } from '../actions';
import { badge, caption, col, image, row, text } from '../primitives';

export interface AccountRowParams {
  accountId: string;
  avatarUri: string;
  name: string;
  address: string;
  typeLabel?: string;
}

export function accountRow(params: AccountRowParams): ListViewItemNode {
  const body = col(
    [
      text(params.name, { weight: 'semibold', truncate: true }),
      caption(params.address, { color: 'secondary', truncate: true }),
    ],
    { gap: 2, flex: 1 },
  );

  return {
    type: 'ListViewItem',
    onClickAction: {
      type: ACCOUNT_PRESS,
      payload: { accountId: params.accountId },
    },
    align: 'center',
    gap: 12,
    children: [
      row(
        [
          image(params.avatarUri, { size: 40, radius: 'full' }),
          body,
          ...(params.typeLabel
            ? [badge(params.typeLabel, { color: 'secondary', variant: 'soft', size: 'sm' })]
            : []),
        ],
        { align: 'center', gap: 12, flex: 1 },
      ),
    ],
  };
}
