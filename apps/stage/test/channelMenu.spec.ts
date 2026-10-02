import { describe, expect, test } from 'bun:test';
import { channelMenuItems } from '../components/ChannelMenu.model';

describe('channelMenuItems', () => {
  test('a channel with search matches the legacy item list', () => {
    const items = channelMenuItems(
      { isGroup: true, hasPeer: false, isUnread: true, isPinned: false },
      { search: true },
    );
    expect(items).toEqual([
      { id: 'search', label: 'Search', icon: 'IconMagnifyingGlass' },
      { id: 'add-members', label: 'Add members', icon: 'IconPlusLarge' },
      { id: 'toggle-read', label: 'Mark as read', icon: 'IconCheckmark1' },
      { id: 'toggle-pin', label: 'Pin', icon: 'IconThumbtack' },
      { id: 'info', label: 'Channel info', icon: 'IconGroup1' },
      { id: 'sync', label: 'Check sync', icon: 'IconDevices' },
      { id: 'leave', label: 'Leave channel', icon: 'IconArrowLeft', danger: true },
    ]);
  });

  test('a channel the user can edit offers Edit channel after Channel info', () => {
    const items = channelMenuItems(
      { isGroup: true, hasPeer: false, isUnread: false, isPinned: false },
      { search: true, edit: true },
    );
    expect(items.map(i => i.id)).toEqual(['search', 'add-members', 'toggle-read', 'toggle-pin', 'info', 'sync', 'edit', 'leave']);
    expect(items.find(i => i.id === 'edit')).toEqual({ id: 'edit', label: 'Edit channel', icon: 'IconPencil' });
  });

  test('a direct chat never offers Edit channel', () => {
    const items = channelMenuItems({ isGroup: false, hasPeer: true, isUnread: false }, { search: true, edit: true });
    expect(items.some(i => i.id === 'edit')).toBe(false);
  });

  test('dm with peer shows Profile info, Delete chat and no channel items', () => {
    const items = channelMenuItems(
      { isGroup: false, hasPeer: true, isUnread: false, isPinned: true },
      { search: false },
    );
    expect(items.map(i => i.id)).toEqual(['toggle-read', 'toggle-pin', 'info', 'delete']);
    expect(items.find(i => i.id === 'info')?.label).toBe('Profile');
    expect(items.find(i => i.id === 'toggle-pin')?.label).toBe('Unpin');
    expect(items.at(-1)).toEqual({ id: 'delete', label: 'Delete chat', icon: 'IconTrashCan', danger: true });
  });

  test('a direct chat without a peer only offers read and pin', () => {
    const items = channelMenuItems({ isGroup: false, hasPeer: false, isUnread: false }, { search: false });
    expect(items).toEqual([
      { id: 'toggle-read', label: 'Mark as unread', icon: 'IconEmail1' },
      { id: 'toggle-pin', label: 'Pin', icon: 'IconThumbtack' },
    ]);
  });
});
