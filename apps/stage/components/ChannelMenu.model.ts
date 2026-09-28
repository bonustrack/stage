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

export function channelMenuItems(state: ChannelMenuState, { search }: { search: boolean }): MenuSheetItem[] {
  const { isGroup, isUnread } = state;
  const items: (MenuSheetItem | null | false)[] = [
    search && { id: 'search', label: 'Search', icon: 'IconMagnifyingGlass' },
    isGroup && { id: 'add-members', label: 'Add members', icon: 'IconPlusLarge' },
    { id: 'toggle-read', label: isUnread ? 'Mark as read' : 'Mark as unread', icon: isUnread ? 'IconCheckmark1' : 'IconEmail1' },
    { id: 'toggle-pin', label: state.isPinned === true ? 'Unpin' : 'Pin', icon: 'IconThumbtack' },
    infoItem(state),
    isGroup && { id: 'leave', label: 'Leave group', icon: 'IconArrowLeft', danger: true },
    !isGroup && state.hasPeer === true && { id: 'delete', label: 'Delete chat', icon: 'IconTrashCan', danger: true },
  ];
  return items.filter((item): item is MenuSheetItem => item !== null && item !== false);
}
