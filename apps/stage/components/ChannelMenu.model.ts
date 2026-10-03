import type { MenuItem } from './appIcons';

export const EDIT_CHANNEL_ITEM: MenuItem<'edit'> = { id: 'edit', label: 'Edit channel', icon: 'IconPencil' };

export const LEAVE_CHANNEL_ITEM: MenuItem<'leave'> = { id: 'leave', label: 'Leave channel', icon: 'IconArrowLeft', danger: true };

export const LEAVE_CHANNEL_CONFIRM = {
  title: 'Leave channel',
  message: 'You’ll stop receiving messages from this channel. You can be re-added by a member later.',
  confirmLabel: 'Leave',
  destructive: true,
} as const;

interface ChannelMenuState {
  isGroup: boolean;
  hasPeer?: boolean;
  isUnread: boolean;
  isPinned?: boolean;
}

function infoItem(state: ChannelMenuState): MenuItem | null {
  if (state.isGroup) return { id: 'info', label: 'Channel info', icon: 'IconGroup1' };
  if (state.hasPeer === true) return { id: 'info', label: 'Profile', icon: 'IconPeople' };
  return null;
}

function closingItems(state: ChannelMenuState, edit: boolean): (MenuItem | false)[] {
  if (state.isGroup) return [edit && EDIT_CHANNEL_ITEM, LEAVE_CHANNEL_ITEM];
  return [state.hasPeer === true && { id: 'delete', label: 'Delete chat', icon: 'IconTrashCan', danger: true }];
}

export function channelMenuItems(
  state: ChannelMenuState, { search, edit = false }: { search: boolean; edit?: boolean },
): MenuItem[] {
  const { isGroup, isUnread } = state;
  const items: (MenuItem | null | false)[] = [
    search && { id: 'search', label: 'Search', icon: 'IconMagnifyingGlass' },
    isGroup && { id: 'add-members', label: 'Add members', icon: 'IconPlusLarge' },
    { id: 'toggle-read', label: isUnread ? 'Mark as read' : 'Mark as unread', icon: isUnread ? 'IconCheckmark1' : 'IconEmail1' },
    { id: 'toggle-pin', label: state.isPinned === true ? 'Unpin' : 'Pin', icon: 'IconThumbtack' },
    infoItem(state),
    (isGroup || state.hasPeer !== true) && { id: 'sync', label: 'Check sync', icon: 'IconDevices' },
    ...closingItems(state, edit),
  ];
  return items.filter((item): item is MenuItem => item !== null && item !== false);
}
