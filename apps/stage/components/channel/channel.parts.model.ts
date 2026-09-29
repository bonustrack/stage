import type { AppIconName } from '../appIcons';

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

interface ChannelProfileMenuItem { id: 'edit' | 'leave'; label: string; icon: AppIconName; danger?: boolean }

const LEAVE_CHANNEL_ITEM: ChannelProfileMenuItem = { id: 'leave', label: 'Leave channel', icon: 'IconArrowLeft', danger: true };

export function channelProfileMenuItems(canEdit: boolean): ChannelProfileMenuItem[] {
  return canEdit ? [{ id: 'edit', label: 'Edit channel', icon: 'IconPencil' }, LEAVE_CHANNEL_ITEM] : [LEAVE_CHANNEL_ITEM];
}
