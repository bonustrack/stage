import { describe, expect, test } from 'bun:test';
import { channelMenuItems } from '../components/ChannelMenu.model';

describe('channelMenuItems', () => {
  test('full mobile feature set for a group matches the legacy item list', () => {
    const items = channelMenuItems(
      { isGroup: true, hasPeer: false, isUnread: true, isPinned: false },
      { search: true, addMembers: true, pin: true, info: true, leaveGroup: true },
    );
    expect(items).toEqual([
      { id: 'search', label: 'Search', icon: 'search' },
      { id: 'add-members', label: 'Add members', icon: 'plus' },
      { id: 'toggle-read', label: 'Mark as read', icon: 'check' },
      { id: 'toggle-pin', label: 'Pin', icon: 'mapPin' },
      { id: 'info', label: 'Group info', icon: 'users' },
      { id: 'leave', label: 'Leave group', icon: 'arrowLeft', danger: true },
    ]);
  });

  test('dm with peer shows Profile info and no group items', () => {
    const items = channelMenuItems(
      { isGroup: false, hasPeer: true, isUnread: false, isPinned: true },
      { addMembers: true, pin: true, info: true, leaveGroup: true },
    );
    expect(items.map(i => i.id)).toEqual(['toggle-read', 'toggle-pin', 'info']);
    expect(items.find(i => i.id === 'info')?.label).toBe('Profile');
    expect(items.find(i => i.id === 'toggle-pin')?.label).toBe('Unpin');
  });

  test('default features yield the web single-item menu', () => {
    const items = channelMenuItems({ isGroup: false, isUnread: false });
    expect(items).toEqual([
      { id: 'toggle-read', label: 'Mark as unread', icon: 'envelope' },
    ]);
  });
});
