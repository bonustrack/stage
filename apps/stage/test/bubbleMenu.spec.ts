import { describe, expect, test } from 'bun:test';
import { bubbleMenuItems } from '../components/conversation/bubbleMenu.model';

describe('bubbleMenuItems', () => {
  test('native text message offers Reply, Copy, Select and Share link', () => {
    const items = bubbleMenuItems(true, { selectText: true });
    expect(items.map((i) => i.id)).toEqual(['reply', 'copy', 'select', 'shareLink']);
    expect(items.map((i) => i.label)).toEqual(['Reply', 'Copy', 'Select', 'Share link']);
  });

  test('web text message drops Select and keeps the rest', () => {
    expect(bubbleMenuItems(true, { selectText: false }).map((i) => i.label)).toEqual(['Reply', 'Copy', 'Share link']);
  });

  test('a frame that can be added to the dashboard offers it before Share link', () => {
    expect(bubbleMenuItems(true, { selectText: false, addToDashboard: true }).find((i) => i.id === 'addToDashboard')?.label).toBe(
      'Add to dashboard',
    );
    expect(bubbleMenuItems(true, { selectText: false, canDelete: true, addToDashboard: true }).map((i) => i.id)).toEqual([
      'reply',
      'copy',
      'addToDashboard',
      'shareLink',
      'delete',
    ]);
    expect(bubbleMenuItems(true, { selectText: false }).map((i) => i.id)).not.toContain('addToDashboard');
  });

  test('Delete comes last, in red, only when allowed', () => {
    const items = bubbleMenuItems(true, { selectText: false, canDelete: true });
    expect(items.at(-1)).toMatchObject({ id: 'delete', label: 'Delete', danger: true });
    expect(items.filter((i) => i.danger === true).map((i) => i.id)).toEqual(['delete']);
    expect(bubbleMenuItems(true, { selectText: false }).map((i) => i.id)).not.toContain('delete');
  });

  test('without the dashboard action the menu keeps only the normal actions', () => {
    expect(bubbleMenuItems(true, { selectText: false, canDelete: true, addToDashboard: false }).map((i) => i.id)).toEqual([
      'reply',
      'copy',
      'shareLink',
      'delete',
    ]);
    expect(bubbleMenuItems(false, { selectText: false, addToDashboard: false }).map((i) => i.id)).toEqual(['reply', 'shareLink']);
  });

  test('message without text offers only Reply and Share link', () => {
    expect(bubbleMenuItems(false, { selectText: true }).map((i) => i.id)).toEqual(['reply', 'shareLink']);
    expect(bubbleMenuItems(false, { selectText: false }).map((i) => i.id)).toEqual(['reply', 'shareLink']);
  });
});
