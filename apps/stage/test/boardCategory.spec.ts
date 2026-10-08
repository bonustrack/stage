import { describe, expect, test } from 'bun:test';
import {
  addedColumnOrder, boardColumns, cardColumnEdit, columnCarriers, columnsEditable, deleteColumnConfirm, deletedColumnOrder,
  keptColumnOrder, orderedColumns, renamedColumnOrder, renameTarget, searchedColumns,
} from '../components/board/BoardScreen.model';
import { configuredFieldOptions } from '../components/channel/channelFieldOptions.model';
import { searchFilterSources } from '../components/searchFilter.model';

const row = (convId: string, category?: string) => ({
  convId, category, title: convId, lastTs: 1, lastPreview: '', unreadCount: 0, labels: ['Legacy'], status: 'Todo',
});
const rows = [row('a', 'Stage'), row('b', 'stage'), row('c', 'Metro')];
const order = ['category:metro', 'category:fde', 'category:stage', 'category:FDE', 'category:', 'status:Done'];
const columns = orderedColumns(boardColumns(rows, [], order, 'category'), order);
const keys = columns.map(column => column.key);

describe('configured category board columns', () => {
  test('includes empty configured categories in saved order with the same names as the picker', () => {
    const options = configuredFieldOptions('category', searchFilterSources(rows, 'board').categories, order);
    expect(columns.map(column => column.label)).toEqual(options);
    expect(columns.map(column => [column.label, column.rows.length])).toEqual([['Metro', 1], ['fde', 0], ['Stage', 2]]);
    expect(columnsEditable('category')).toBe(true);
  });

  test('keeps empty columns without any channels and when every card is filtered or hidden', () => {
    const empty = orderedColumns(boardColumns([], [], order, 'category'), order);
    expect(empty.map(column => [column.label, column.rows.length])).toEqual([['metro', 0], ['fde', 0], ['stage', 0]]);
    expect(searchedColumns(columns, 'category:fde').map(column => [column.label, column.rows.length]))
      .toEqual([['Metro', 0], ['fde', 0], ['Stage', 0]]);
    expect(boardColumns(rows, [], order, 'category', undefined, () => true).every(column => column.rows.length === 0)).toBe(true);
    expect(boardColumns([], [], [], 'category')).toEqual([]);
  });

  test('renames an empty category in place, preserving its spelling and the other columns', () => {
    const next = renamedColumnOrder(keys, order, 'FDE', 'FDE Team', 'category');
    expect(orderedColumns(boardColumns(rows, [], next, 'category'), next).map(column => column.label))
      .toEqual(['Metro', 'FDE Team', 'Stage']);
    expect(columnCarriers(rows, 'fde', 'category')).toEqual([]);
    expect(columnCarriers(rows, 'STAGE', 'category')).toEqual(['a', 'b']);
    expect(renameTarget(columns, 'fde', 'STAGE')).toEqual({ name: 'Stage', merge: true });
    const merged = renamedColumnOrder(keys, order, 'fde', 'Stage', 'category');
    expect(orderedColumns(boardColumns(rows, [], merged, 'category'), merged).map(column => column.label)).toEqual(['Metro', 'Stage']);
  });

  test('deletes only the configured empty value and does not recreate it from the other grouping', () => {
    const next = deletedColumnOrder(keys, order, 'FDE', 'category');
    expect(next).toEqual(['category:Metro', 'category:Stage', 'category:', 'status:Done']);
    expect(orderedColumns(boardColumns(rows, [], next, 'category'), next).map(column => column.label)).toEqual(['Metro', 'Stage']);
    expect(deleteColumnConfirm('fde', 0, 'category').message).toBe('No channel has the fde project.');
    expect(deleteColumnConfirm('Stage', 2, 'category').message)
      .toBe('This removes the Stage project from 2 channels. They move to No project. Labels are kept.');
  });

  test('adds empty categories and retains a category when its last card moves', () => {
    const next = addedColumnOrder(keys, order, 'New Team', 'category');
    expect(orderedColumns(boardColumns(rows, [], next, 'category'), next).at(-1)?.label).toBe('New Team');
    expect(cardColumnEdit(columns, 'category:Metro', 'category:fde', 'category')).toEqual({ by: 'category', value: 'fde' });
    expect(keptColumnOrder(columns, [], 'category:Metro')).toEqual(keys);
    const withUnset = boardColumns([row('a', 'No project'), row('b')], [], [], 'category');
    expect(cardColumnEdit(withUnset, 'category:No project', 'category:', 'category')).toEqual({ by: 'category', value: null });
    expect(cardColumnEdit(withUnset, 'category:', 'category:No project', 'category')).toEqual({ by: 'category', value: 'No project' });
  });

  test('keeps emoji-distinct categories and retains empty configured statuses and labels', () => {
    const configured = ['category:👀 Review', 'category:🔍 Review', 'category:👀 review'];
    expect(boardColumns([], [], configured, 'category').map(column => column.label)).toEqual(['👀 Review', '🔍 Review']);
    expect(boardColumns([], [], ['status:✅ Done'], 'status').map(column => column.label)).toEqual(['✅ Done']);
    expect(boardColumns([], [], ['label:Later'], 'label').map(column => column.label)).toEqual(['Later']);
  });

  test('keeps saved empty assignee columns using the same name resolver without making people editable', () => {
    const saved = ['assignee:0xbob', 'assignee:0xBOB', 'assignee:', 'category:fde'];
    expect(boardColumns([], [], saved, 'assignee', () => 'Bob')).toEqual([{ key: 'assignee:0xbob', label: 'Bob', rows: [] }]);
    expect(columnsEditable('assignee')).toBe(false);
  });
});
