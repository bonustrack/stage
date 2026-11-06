import { describe, expect, test } from 'bun:test';
import { channelMenuItems } from '../components/chatRow/ChannelMenu.model';

const shown = (items: readonly { id: string; label: string; danger?: boolean }[]): string[] =>
  items.map((item) => `${item.label}${item.danger === true ? ' (danger)' : ''}`);

describe('channelMenuItems', () => {
  test('an unread channel with search offers the channel actions, Leave channel last and in red', () => {
    const items = channelMenuItems(
      { isGroup: true, hasPeer: false, isUnread: true, isPinned: false },
      { search: true, developerMode: true },
    );
    expect(items.map((i) => i.id)).toEqual(['search', 'add-members', 'toggle-read', 'toggle-pin', 'info', 'sync', 'leave']);
    expect(shown(items)).toEqual(['Search', 'Add members', 'Mark as read', 'Pin', 'Channel info', 'Check sync', 'Leave channel (danger)']);
  });

  test('a channel the user can edit offers Edit channel after Channel info', () => {
    const items = channelMenuItems(
      { isGroup: true, hasPeer: false, isUnread: false, isPinned: false },
      { search: true, edit: true, developerMode: true },
    );
    expect(items.map((i) => i.id)).toEqual(['search', 'add-members', 'toggle-read', 'toggle-pin', 'info', 'sync', 'edit', 'leave']);
    expect(items.find((i) => i.id === 'edit')?.label).toBe('Edit channel');
  });

  test('a direct chat never offers Edit channel', () => {
    const items = channelMenuItems({ isGroup: false, hasPeer: true, isUnread: false }, { search: true, edit: true });
    expect(items.some((i) => i.id === 'edit')).toBe(false);
  });

  test('dm with peer shows Profile info, Delete chat and no channel items', () => {
    const items = channelMenuItems({ isGroup: false, hasPeer: true, isUnread: false, isPinned: true }, { search: false });
    expect(items.map((i) => i.id)).toEqual(['toggle-read', 'toggle-pin', 'info', 'delete']);
    expect(items.find((i) => i.id === 'info')?.label).toBe('Profile');
    expect(items.find((i) => i.id === 'toggle-pin')?.label).toBe('Unpin');
    expect(shown(items).at(-1)).toBe('Delete chat (danger)');
  });

  test('Check sync is hidden by default without changing normal channel actions', () => {
    expect(channelMenuItems({ isGroup: true, isUnread: true }, { search: true, edit: true }).map((i) => i.id)).toEqual([
      'search',
      'add-members',
      'toggle-read',
      'toggle-pin',
      'info',
      'edit',
      'leave',
    ]);
    expect(channelMenuItems({ isGroup: false, isUnread: false }, { search: false, developerMode: false }).map((i) => i.id)).toEqual([
      'toggle-read',
      'toggle-pin',
    ]);
  });

  test('an unresolved chat still offers the sync check', () => {
    const items = channelMenuItems({ isGroup: false, hasPeer: false, isUnread: false }, { search: false, developerMode: true });
    expect(items.map((i) => i.id)).toEqual(['toggle-read', 'toggle-pin', 'sync']);
    expect(shown(items)).toEqual(['Mark as unread', 'Pin', 'Check sync']);
  });

  test('the blank pinned conversation menu exposes diagnostics without channel actions', () => {
    const items = channelMenuItems(
      { isGroup: false, hasPeer: false, isUnread: false, isPinned: true },
      { search: true, developerMode: true },
    );
    expect(items.map((i) => i.label)).toEqual(['Search', 'Mark as unread', 'Unpin', 'Check sync']);
  });
});
