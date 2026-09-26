import { describe, expect, test } from 'bun:test';
import { bubbleMenuItems } from '../components/conversation/bubbleMenu.model';

describe('bubbleMenuItems', () => {
  test('native text message offers Reply, Copy, Select and Share link', () => {
    expect(bubbleMenuItems(true, { selectText: true })).toEqual([
      { id: 'reply', icon: 'IconArrowUndoUp', label: 'Reply' },
      { id: 'copy', icon: 'IconSquareBehindSquare1', label: 'Copy' },
      { id: 'select', icon: 'IconFileBend', label: 'Select' },
      { id: 'shareLink', icon: 'IconPaperPlane', label: 'Share link' },
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
