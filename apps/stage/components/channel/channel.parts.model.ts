import type { MenuItem } from '../appIcons';
import { EDIT_CHANNEL_ITEM, LEAVE_CHANNEL_ITEM } from '../ChannelMenu.model';

export type ChannelMemberRole = 'owner' | 'admin' | 'member' | undefined;

export interface MemberRowBadge {
  role: 'owner' | 'admin';
  label: string;
}

interface MemberRowModel {
  displayName: string;
  addressLine?: string;
  badge?: MemberRowBadge;
}

interface MemberRowInput {
  shortAddress: string;
  name: string | null | undefined;
  isSelf: boolean;
  role: ChannelMemberRole;
}

function memberRowBadge(role: ChannelMemberRole): MemberRowBadge | undefined {
  if (role === 'owner') return { role: 'owner', label: 'Owner' };
  if (role === 'admin') return { role: 'admin', label: 'Admin' };
  return undefined;
}

export function memberRowModel(input: MemberRowInput): MemberRowModel {
  const name = input.name ?? '';
  const named = name !== '';
  const base = named ? name : input.shortAddress;
  return {
    displayName: input.isSelf ? `${base} (you)` : base,
    addressLine: named ? input.shortAddress : undefined,
    badge: memberRowBadge(input.role),
  };
}

export function channelProfileMenuItems(canEdit: boolean): MenuItem<'edit' | 'leave'>[] {
  return canEdit ? [EDIT_CHANNEL_ITEM, LEAVE_CHANNEL_ITEM] : [LEAVE_CHANNEL_ITEM];
}
