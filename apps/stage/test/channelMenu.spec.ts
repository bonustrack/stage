import { describe, expect, test } from 'bun:test';
import { channelMenuItems } from '../components/ChannelMenu.model';

describe('channelMenuItems', () => {
  test('a group with search matches the legacy item list', () => {
    const items = channelMenuItems(
      { isGroup: true, hasPeer: false, isUnread: true, isPinned: false },
      { search: true },
    );
    expect(items).toEqual([
      { id: 'search', label: 'Search', icon: 'IconMagnifyingGlass' },
      { id: 'add-members', label: 'Add members', icon: 'IconPlusLarge' },
      { id: 'toggle-read', label: 'Mark as read', icon: 'IconCheckmark1' },
      { id: 'toggle-pin', label: 'Pin', icon: 'IconThumbtack' },
      { id: 'info', label: 'Group info', icon: 'IconGroup1' },
      { id: 'leave', label: 'Leave group', icon: 'IconArrowLeft', danger: true },
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
    expect(items.at(-1)).toEqual({ id: 'delete', label: 'Delete chat', icon: 'IconTrashCan', danger: true });
  });

  test('a group offers Show member list while the list is hidden', () => {
    const items = channelMenuItems(
      { isGroup: true, hasPeer: false, isUnread: false },
      { search: true, memberList: 'hidden' },
    );
    expect(items.map(i => i.id).slice(0, 3)).toEqual(['search', 'toggle-members', 'add-members']);
    expect(items[1]).toEqual({ id: 'toggle-members', label: 'Show member list', icon: 'IconTeam' });
  });

  test('a group offers Hide member list while the list is shown', () => {
    const items = channelMenuItems(
      { isGroup: true, hasPeer: false, isUnread: false },
      { search: false, memberList: 'shown' },
    );
    expect(items.find(i => i.id === 'toggle-members')?.label).toBe('Hide member list');
  });

  test('the member list item stays out of direct chats', () => {
    const items = channelMenuItems(
      { isGroup: false, hasPeer: true, isUnread: false },
      { search: true, memberList: 'hidden' },
    );
    expect(items.some(i => i.id === 'toggle-members')).toBe(false);
  });

  test('a direct chat without a peer only offers read and pin', () => {
    const items = channelMenuItems({ isGroup: false, hasPeer: false, isUnread: false }, { search: false });
    expect(items).toEqual([
      { id: 'toggle-read', label: 'Mark as unread', icon: 'IconEmail1' },
      { id: 'toggle-pin', label: 'Pin', icon: 'IconThumbtack' },
    ]);
  });
});
