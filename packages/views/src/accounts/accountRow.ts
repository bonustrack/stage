import type { ListViewItemNode } from '@stage-labs/kit/kit';
import view from './accountRow.json';
import { buildView } from '../buildView';
import { ACCOUNT_PRESS } from '../actions';

export interface AccountRowParams {
  accountId: string;
  avatarUri: string;
  name: string;
  address: string;
  typeLabel?: string;
}

export function accountRow(params: AccountRowParams): ListViewItemNode {
  return (buildView(view, {
    ...params,
    accountPressType: ACCOUNT_PRESS,
  }) as ListViewItemNode);
}
