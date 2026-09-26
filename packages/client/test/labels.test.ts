import { describe, expect, test } from 'bun:test';
import { renameLabels } from '../src/xmtp/labels';

describe('renaming a label inside a group', () => {
  test('replaces the old name in place whatever its case', () => {
    expect(renameLabels(['Urgent', 'todo', 'Done'], 'Todo', 'Doing')).toEqual(['Urgent', 'Doing', 'Done']);
  });

  test('merges into the new name when the group already carries it', () => {
    expect(renameLabels(['Urgent', 'Doing', 'Todo'], 'Todo', 'Doing')).toEqual(['Urgent', 'Doing']);
    expect(renameLabels(['Todo', 'Urgent', 'doing'], 'Todo', 'Doing')).toEqual(['Doing', 'Urgent']);
  });

  test('leaves the labels alone when the group lacks the old name or the new name is empty', () => {
    const labels = ['Urgent'];
    expect(renameLabels(labels, 'Todo', 'Doing')).toBe(labels);
    expect(renameLabels(['Todo'], 'Todo', '   ')).toEqual(['Todo']);
  });
});
