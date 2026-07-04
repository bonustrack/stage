import { compactList } from '../node';

export interface MenuSheetItem {
  id: string;
  label: string;
  icon?: string;
  danger?: boolean;
}

export interface ChannelMenuState {
  isGroup: boolean;
  hasPeer?: boolean;
  isUnread: boolean;
  isPinned?: boolean;
  isArchived?: boolean;
}

export interface ChannelMenuFeatures {
  search?: boolean;
  addMembers?: boolean;
  pin?: boolean;
  info?: boolean;
  leaveGroup?: boolean;
}

function infoItem(state: ChannelMenuState): MenuSheetItem | null {
  if (state.isGroup) return { id: 'info', label: 'Group info', icon: 'users' };
  if (state.hasPeer === true) return { id: 'info', label: 'Profile', icon: 'user' };
  return null;
}

function addMembersItem(state: ChannelMenuState, features: ChannelMenuFeatures): MenuSheetItem | null {
  return features.addMembers === true && state.isGroup
    ? { id: 'add-members', label: 'Add members', icon: 'plus' }
    : null;
}

function toggleReadItem(state: ChannelMenuState): MenuSheetItem {
  return {
    id: 'toggle-read',
    label: state.isUnread ? 'Mark as read' : 'Mark as unread',
    icon: state.isUnread ? 'check' : 'envelope',
  };
}

function pinItem(state: ChannelMenuState, features: ChannelMenuFeatures): MenuSheetItem | null {
  return features.pin === true
    ? { id: 'toggle-pin', label: state.isPinned === true ? 'Unpin' : 'Pin', icon: 'mapPin' }
    : null;
}

function archiveItem(state: ChannelMenuState): MenuSheetItem {
  return {
    id: 'toggle-archive',
    label: state.isArchived === true ? 'Unarchive' : 'Archive',
    icon: state.isArchived === true ? 'arrowUp' : 'archive',
    danger: true,
  };
}

function leaveItem(state: ChannelMenuState, features: ChannelMenuFeatures): MenuSheetItem | null {
  return features.leaveGroup === true && state.isGroup
    ? { id: 'leave', label: 'Leave group', icon: 'arrowLeft', danger: true }
    : null;
}

export function channelMenuItems(
  state: ChannelMenuState,
  features: ChannelMenuFeatures = {},
): MenuSheetItem[] {
  return compactList<MenuSheetItem>([
    features.search === true ? { id: 'search', label: 'Search', icon: 'search' } : null,
    addMembersItem(state, features),
    toggleReadItem(state),
    pinItem(state, features),
    features.info === true ? infoItem(state) : null,
    archiveItem(state),
    leaveItem(state, features),
  ]);
}
