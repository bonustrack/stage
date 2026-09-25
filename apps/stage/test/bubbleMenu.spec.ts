import { describe, expect, test } from 'bun:test';
import { bubbleMenuItems } from '../components/conversation/bubbleMenu.model';

describe('bubbleMenuItems', () => {
  test('native text message offers Reply, Copy, Select and Share link', () => {
    expect(bubbleMenuItems(true, { selectText: true })).toEqual([
      { id: 'reply', icon: 'reply', label: 'Reply' },
      { id: 'copy', icon: 'copy', label: 'Copy' },
      { id: 'select', icon: 'document', label: 'Select' },
      { id: 'shareLink', icon: 'send', label: 'Share link' },
    ]);
  });

  test('web text message drops Select and keeps the rest', () => {
    expect(bubbleMenuItems(true, { selectText: false }).map(i => i.label)).toEqual(['Reply', 'Copy', 'Share link']);
  });

  test('message without text offers only Reply and Share link', () => {
    expect(bubbleMenuItems(false, { selectText: true }).map(i => i.id)).toEqual(['reply', 'shareLink']);
    expect(bubbleMenuItems(false, { selectText: false }).map(i => i.id)).toEqual(['reply', 'shareLink']);
  });
});
