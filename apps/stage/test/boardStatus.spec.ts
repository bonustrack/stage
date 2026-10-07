import { describe, expect, test } from 'bun:test';
import {
  addColumnProblem, addedColumnOrder, addItemRows, boardColumns, cardColumnEdit, columnCarriers, columnEditable, columnsEditable,
  deleteColumnConfirm, deletedColumnOrder, keptColumnOrder, orderedColumns, renamedColumnOrder, renameTarget,
} from '../components/board/BoardScreen.model';

const row = (convId: string, status?: string | null) => ({
  convId, status, title: convId, lastTs: 1, lastPreview: '', unreadCount: 0, labels: ['Legacy', 'Done'], category: 'Stage',
});
const rows = [row('a', 'Todo'), row('b', 'todo'), row('c', 'Done'), row('d'), row('e', '  ')];
const columns = boardColumns(rows, [], []);
const keys = columns.map(c => c.key);

describe('status board', () => {
  test('defaults to singular status, not labels or category, with unset status grouped last', () => {
    expect(columns.map(c => [c.key, c.label, c.rows.map(r => r.convId)])).toEqual([
      ['status:Done', 'Done', ['c']], ['status:Todo', 'Todo', ['a', 'b']], ['status:', 'No status', ['d', 'e']],
    ]);
    expect(boardColumns([], [], [])).toEqual([]);
    expect(boardColumns([{ ...row('dm', 'Todo'), peerAddress: '0xpeer' }], [], [])).toEqual([]);
  });

  test('keeps the full emoji and text of Backlog, To-do and custom statuses', () => {
    const statuses = ['🗒️ Backlog', '🎯 To-do', '🚧 In progress', '🔍 In review', '✅ Done', '🚫 Blocked', 'Waiting on QA'];
    const grouped = boardColumns(statuses.map((status, i) => row(`${i}`, status)), [], []);
    const named = grouped.filter(column => columnEditable(column.key));
    expect(new Set(named.map(column => column.label))).toEqual(new Set(statuses));
    for (const column of named) expect(column.rows[0]?.status).toBe(column.label);
  });

  test('status columns are editable but the unset placeholder is not a status value', () => {
    expect(columnsEditable('status')).toBe(true);
    expect(columnEditable('status:Todo')).toBe(true);
    expect(columnEditable('status:')).toBe(false);
    expect(columnEditable('category:Stage')).toBe(true);
    expect(columnEditable('category:')).toBe(false);
    expect(columnEditable('assignee:0xbob')).toBe(false);
  });

  test('remembers empty status columns separately from the saved label layout', () => {
    const order = addedColumnOrder(keys, ['label:Old'], 'Blocked', 'status');
    expect(orderedColumns(boardColumns(rows, [], order), order).map(c => c.key))
      .toEqual([...keys, 'status:Blocked']);
    expect(boardColumns([], [], ['status:Done', 'label:Todo', 'status:done', 'status:']).map(c => c.key))
      .toEqual(['status:Done']);
    expect(keptColumnOrder(columns, [], 'status:Done')).toEqual(keys);
  });

  test('moving a card sets or clears only the status, including a status literally named No status', () => {
    expect(cardColumnEdit(columns, 'status:Todo', 'status:Done', 'status')).toEqual({ by: 'status', value: 'Done' });
    expect(cardColumnEdit(columns, 'status:Done', 'status:', 'status')).toEqual({ by: 'status', value: null });
    expect(cardColumnEdit(columns, 'status:', 'status:Todo', 'status')).toEqual({ by: 'status', value: 'Todo' });
    const named = boardColumns([row('a', 'No status'), row('b')], [], []);
    expect(cardColumnEdit(named, 'status:', 'status:No status', 'status')).toEqual({ by: 'status', value: 'No status' });
    expect(cardColumnEdit(columns, 'status:Todo', 'status:Todo', 'status')).toBeNull();
    expect(cardColumnEdit(columns, 'label:Legacy', 'status:Done', 'status')).toBeNull();
    expect(cardColumnEdit(columns, 'status:Todo', 'status:Missing', 'status')).toBeNull();
  });

  test('retains a clear-status drop target when every visible card has a status', () => {
    const assigned = boardColumns([row('a', 'Todo')], [], []);
    expect(assigned.map(column => [column.key, column.rows.length])).toEqual([['status:Todo', 1], ['status:', 0]]);
    expect(cardColumnEdit(assigned, 'status:Todo', 'status:', 'status')).toEqual({ by: 'status', value: null });
    const hidden = boardColumns([row('a', 'Todo')], [], [], 'status', value => value, () => true);
    expect(hidden.map(column => [column.key, column.rows.length])).toEqual([['status:Todo', 0]]);
    expect(boardColumns([row('a')], [], [], 'status', value => value, () => true)).toEqual([]);
  });

  test('remembers a literal No status column after its final card is cleared', () => {
    const before = boardColumns([row('a', 'No status')], [], []);
    const order = keptColumnOrder(before, [], 'status:No status');
    expect(order).toEqual(['status:No status', 'status:']);
    const after = boardColumns([row('a')], [], order ?? []);
    expect(after.map(column => [column.key, column.rows.length])).toEqual([['status:', 1], ['status:No status', 0]]);
    expect(cardColumnEdit(after, 'status:', 'status:No status', 'status')).toEqual({ by: 'status', value: 'No status' });
  });

  test('adding or renaming to No status never merges with the unset placeholder', () => {
    expect(addColumnProblem(columns, 'No status')).toBeNull();
    expect(renameTarget(columns, 'Todo', 'No status')).toEqual({ name: 'No status', merge: false });
    const named = boardColumns([row('a', 'No status'), row('b')], [], []);
    expect(addColumnProblem(named, 'no status')).toBe('A column named No status already exists.');
    expect(renameTarget(named, 'Todo', 'no status')).toEqual({ name: 'No status', merge: true });
  });

  test('an explicit label board still moves labels rather than status', () => {
    const labeled = boardColumns(rows, [], [], 'label');
    expect(cardColumnEdit(labeled, 'label:Legacy', 'label:Done', 'label'))
      .toEqual({ by: 'label', from: 'Legacy', to: 'Done' });
    expect(cardColumnEdit(columns, 'status:Todo', 'status:Done', 'category')).toBeNull();
  });

  test('add and rename target status carriers, not matching labels', () => {
    expect(columnCarriers(rows, 'Done', 'status')).toEqual(['c']);
    expect(columnCarriers(rows, 'TODO', 'status')).toEqual(['a', 'b']);
    expect(addItemRows(rows, 'Done', '', [], 'status').map(r => r.convId)).toEqual(['a', 'b', 'd', 'e']);
    expect(renamedColumnOrder(keys, ['label:Todo'], 'Todo', 'Doing', 'status'))
      .toEqual(['label:Todo', 'status:Done', 'status:Doing', 'status:']);
    expect(renamedColumnOrder(keys, [], 'Todo', 'Done', 'status')).toEqual(['status:Done', 'status:']);
  });

  test('deleting a status column clears status without deleting labels', () => {
    expect(deletedColumnOrder(keys, ['label:Todo'], 'Todo', 'status')).toEqual(['label:Todo', 'status:Done', 'status:']);
    expect(deleteColumnConfirm('Todo', 2, 'status').message)
      .toBe('This removes the Todo status from 2 channels. They move to No status. Labels are kept.');
  });
});
