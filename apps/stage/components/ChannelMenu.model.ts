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
  if (state.isGroup) return { id: 'info', label: 'Channel info', icon: 'IconGroup1' };
  if (state.hasPeer === true) return { id: 'info', label: 'Profile', icon: 'IconPeople' };
  return null;
}

function closingItems(state: ChannelMenuState, edit: boolean): (MenuSheetItem | false)[] {
  if (state.isGroup) {
    return [
      edit && { id: 'edit', label: 'Edit channel', icon: 'IconPencil' },
      { id: 'leave', label: 'Leave channel', icon: 'IconArrowLeft', danger: true },
    ];
  }
  return [state.hasPeer === true && { id: 'delete', label: 'Delete chat', icon: 'IconTrashCan', danger: true }];
}

export function channelMenuItems(
  state: ChannelMenuState, { search, edit = false }: { search: boolean; edit?: boolean },
): MenuSheetItem[] {
  const { isGroup, isUnread } = state;
  const items: (MenuSheetItem | null | false)[] = [
    search && { id: 'search', label: 'Search', icon: 'IconMagnifyingGlass' },
    isGroup && { id: 'add-members', label: 'Add members', icon: 'IconPlusLarge' },
    { id: 'toggle-read', label: isUnread ? 'Mark as read' : 'Mark as unread', icon: isUnread ? 'IconCheckmark1' : 'IconEmail1' },
    { id: 'toggle-pin', label: state.isPinned === true ? 'Unpin' : 'Pin', icon: 'IconThumbtack' },
    infoItem(state),
    ...closingItems(state, edit),
  ];
  return items.filter((item): item is MenuSheetItem => item !== null && item !== false);
}
