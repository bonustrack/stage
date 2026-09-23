interface MenuSheetItem {
  id: string;
  label: string;
  icon?: string;
  danger?: boolean;
}

interface ChannelMenuState {
  isGroup: boolean;
  hasPeer?: boolean;
  isUnread: boolean;
  isPinned?: boolean;
}

function infoItem(state: ChannelMenuState): MenuSheetItem | null {
  if (state.isGroup) return { id: 'info', label: 'Group info', icon: 'users' };
  if (state.hasPeer === true) return { id: 'info', label: 'Profile', icon: 'user' };
  return null;
}

export function channelMenuItems(state: ChannelMenuState, { search }: { search: boolean }): MenuSheetItem[] {
  const { isGroup, isUnread } = state;
  const items: (MenuSheetItem | null | false)[] = [
    search && { id: 'search', label: 'Search', icon: 'search' },
    isGroup && { id: 'add-members', label: 'Add members', icon: 'plus' },
    { id: 'toggle-read', label: isUnread ? 'Mark as read' : 'Mark as unread', icon: isUnread ? 'check' : 'envelope' },
    { id: 'toggle-pin', label: state.isPinned === true ? 'Unpin' : 'Pin', icon: 'pin' },
    infoItem(state),
    isGroup && { id: 'leave', label: 'Leave group', icon: 'arrowLeft', danger: true },
    !isGroup && state.hasPeer === true && { id: 'delete', label: 'Delete chat', icon: 'trash', danger: true },
  ];
  return items.filter((item): item is MenuSheetItem => item !== null && item !== false);
}
