import { describe, expect, test } from 'bun:test';
import { channelRowModel } from '../src/chat/channelRowModel';

describe('channelRowModel', () => {
  test('minimal domain maps to empty-preview params', () => {
    const p = channelRowModel({ convId: 'c1', title: 'Alice', avatarUri: 'u' });
    expect(p).toEqual({
      convId: 'c1',
      avatarUri: 'u',
      title: 'Alice',
      titleSegments: undefined,
      preview: '',
      previewPrefix: undefined,
      timestamp: '',
      unreadBadge: undefined,
      chips: undefined,
      pinned: undefined,
      labelPressable: undefined,
      omitAvatar: undefined,
      interactive: undefined,
    });
  });

  test('draft wins over preview and adds You: prefix, suppressing chips', () => {
    const p = channelRowModel({
      convId: 'c1', title: 'Alice', avatarUri: 'u',
      lastPreview: 'hello', hasDraft: true, draftText: '  wip  ',
      labels: ['a', 'b', 'c'], timestampLabel: '9:15 AM',
    });
    expect(p.preview).toBe('wip');
    expect(p.previewPrefix).toBe('You:');
    expect(p.chips).toBeUndefined();
    expect(p.timestamp).toBe('9:15 AM');
  });

  test('labels truncate to two with overflow chip', () => {
    const p = channelRowModel({
      convId: 'c1', title: 'Alice', avatarUri: 'u', labels: ['a', 'b', 'c', 'd'],
    });
    expect(p.chips).toEqual([{ label: 'a' }, { label: 'b' }, { label: '+2' }]);
  });

  test('preview falls back lastPreview -> subtitle -> emptyPreview', () => {
    const base = { convId: 'c', title: 't', avatarUri: 'u' };
    expect(channelRowModel({ ...base, lastPreview: 'p', subtitle: 's' }).preview).toBe('p');
    expect(channelRowModel({ ...base, lastPreview: '', subtitle: 's' }).preview).toBe('s');
    expect(channelRowModel({ ...base, emptyPreview: '(no messages yet)' }).preview).toBe('(no messages yet)');
  });

  test('unread badge and highlight segments', () => {
    const p = channelRowModel({
      convId: 'c', title: 'Alice Smith', avatarUri: 'u',
      unreadCount: 120, highlightQuery: 'ali',
    });
    expect(p.unreadBadge).toBe('99+');
    expect(p.titleSegments).toEqual([
      { text: 'Ali', emphasized: true },
      { text: 'ce Smith', emphasized: false },
    ]);
  });
});
