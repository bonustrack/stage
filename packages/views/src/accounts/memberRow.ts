import type { ListViewItemNode } from '@stage-labs/kit/kit';
import view from './memberRow.json';
import { buildView } from '../buildView';
import { MEMBER_PRESS, MEMBER_REMOVE } from '../actions';

export type MemberBadgeRole = 'owner' | 'admin';

interface MemberBadge {
  label: string;
  background: string;
  color: string;
}

export interface MemberRowParams {
  memberId: string;
  avatarUri: string;
  name: string;
  address?: string;
  role?: MemberBadgeRole;
  removable?: boolean;
  dark: boolean;
  borderColor: string;
  subColor: string;
  dangerColor: string;
  removePressedBg: string;
}

function memberBadge(params: MemberRowParams): MemberBadge | undefined {
  if (params.role === 'owner') {
    return {
      label: 'Owner',
      background: params.dark ? 'rgba(45,212,191,0.18)' : 'rgba(13,148,136,0.12)',
      color: params.dark ? '#2dd4bf' : '#0d9488',
    };
  }
  if (params.role === 'admin') {
    return { label: 'Admin', background: params.borderColor, color: params.subColor };
  }
  return undefined;
}

export function memberRow(params: MemberRowParams): ListViewItemNode {
  return (buildView(view, {
    memberId: params.memberId,
    avatarUri: params.avatarUri,
    name: params.name,
    address: params.address,
    badge: memberBadge(params),
    dangerColor: params.dangerColor,
    removePressedBg: params.removePressedBg,
    memberPressType: MEMBER_PRESS,
    memberRemoveType: MEMBER_REMOVE,
    hasAddress:
      (params.address !== undefined && params.address !== '') || undefined,
    removable: params.removable === true || undefined,
  }) as ListViewItemNode);
}
