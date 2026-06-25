import type { BadgeColor, ListViewItemNode } from '@stage-labs/kit/kit';
import view from './memberRow.json';
import { buildView } from '../buildView';
import { MEMBER_PRESS, MEMBER_REMOVE } from '../actions';

export interface MemberRowParams {
  memberId: string;
  avatarUri: string;
  name: string;
  address?: string;
  roleLabel?: string;
  roleColor?: BadgeColor;
  removable?: boolean;
}

export function memberRow(params: MemberRowParams): ListViewItemNode {
  return (buildView(view, {
    memberId: params.memberId,
    avatarUri: params.avatarUri,
    name: params.name,
    address: params.address,
    roleLabel: params.roleLabel,
    roleColor: params.roleColor ?? 'discovery',
    memberPressType: MEMBER_PRESS,
    memberRemoveType: MEMBER_REMOVE,
    hasAddress:
      (params.address !== undefined && params.address !== '') || undefined,
    hasRole:
      (params.roleLabel !== undefined && params.roleLabel !== '') || undefined,
    removable: params.removable === true || undefined,
  }) as ListViewItemNode);
}
