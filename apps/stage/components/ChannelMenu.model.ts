import type { AppIconName } from './appIcons';

interface MenuSheetItem {
  id: string;
  label: string;
  icon?: AppIconName;
  danger?: boolean;
}

interface ChannelMenuState {
  isGroup: boolean;
  hasPeer?: boolean;
  isUnread: boolean;
  isPinned?: boolean;
}

function infoItem(state: ChannelMenuState): MenuSheetItem | null {
  if (state.isGroup) return { id: 'info', label: 'Group info', icon: 'IconGroup1' };
  if (state.hasPeer === true) return { id: 'info', label: 'Profile', icon: 'IconPeople' };
  return null;
}

export type MemberListState = 'shown' | 'hidden';

interface ChannelMenuOptions {
  search: boolean;
  memberList?: MemberListState;
}

function memberListItem(state: ChannelMenuState, memberList: MemberListState | undefined): MenuSheetItem | null {
  if (memberList === undefined || (!state.isGroup && !state.hasPeer)) return null;
  const action = memberList === 'shown' ? 'Hide' : 'Show';
  const subject = state.isGroup ? 'member list' : 'profile panel';
  return { id: 'toggle-members', label: `${action} ${subject}`, icon: state.isGroup ? 'IconTeam' : 'IconPeople' };
}

export function channelMenuItems(state: ChannelMenuState, { search, memberList }: ChannelMenuOptions): MenuSheetItem[] {
  const { isGroup, isUnread } = state;
  const items: (MenuSheetItem | null | false)[] = [
    search && { id: 'search', label: 'Search', icon: 'IconMagnifyingGlass' },
    memberListItem(state, memberList),
    isGroup && { id: 'add-members', label: 'Add members', icon: 'IconPlusLarge' },
    { id: 'toggle-read', label: isUnread ? 'Mark as read' : 'Mark as unread', icon: isUnread ? 'IconCheckmark1' : 'IconEmail1' },
    { id: 'toggle-pin', label: state.isPinned === true ? 'Unpin' : 'Pin', icon: 'IconThumbtack' },
    infoItem(state),
    isGroup && { id: 'leave', label: 'Leave group', icon: 'IconArrowLeft', danger: true },
    !isGroup && state.hasPeer === true && { id: 'delete', label: 'Delete chat', icon: 'IconTrashCan', danger: true },
  ];
  return items.filter((item): item is MenuSheetItem => item !== null && item !== false);
}
