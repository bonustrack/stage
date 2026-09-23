import { describe, expect, test } from 'bun:test';
import { channelMenuItems } from '../components/ChannelMenu.model';

describe('channelMenuItems', () => {
  test('a group with search matches the legacy item list', () => {
    const items = channelMenuItems(
      { isGroup: true, hasPeer: false, isUnread: true, isPinned: false },
      { search: true },
    );
    expect(items).toEqual([
      { id: 'search', label: 'Search', icon: 'search' },
      { id: 'add-members', label: 'Add members', icon: 'plus' },
      { id: 'toggle-read', label: 'Mark as read', icon: 'check' },
      { id: 'toggle-pin', label: 'Pin', icon: 'pin' },
      { id: 'info', label: 'Group info', icon: 'users' },
      { id: 'leave', label: 'Leave group', icon: 'arrowLeft', danger: true },
    ]);
  });

  test('dm with peer shows Profile info, Delete chat and no group items', () => {
    const items = channelMenuItems(
      { isGroup: false, hasPeer: true, isUnread: false, isPinned: true },
      { search: false },
    );
    expect(items.map(i => i.id)).toEqual(['toggle-read', 'toggle-pin', 'info', 'delete']);
    expect(items.find(i => i.id === 'info')?.label).toBe('Profile');
    expect(items.find(i => i.id === 'toggle-pin')?.label).toBe('Unpin');
    expect(items.at(-1)).toEqual({ id: 'delete', label: 'Delete chat', icon: 'trash', danger: true });
  });

  test('a direct chat without a peer only offers read and pin', () => {
    const items = channelMenuItems({ isGroup: false, hasPeer: false, isUnread: false }, { search: false });
    expect(items).toEqual([
      { id: 'toggle-read', label: 'Mark as unread', icon: 'envelope' },
      { id: 'toggle-pin', label: 'Pin', icon: 'pin' },
    ]);
  });
});
