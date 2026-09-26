import { describe, expect, test } from 'bun:test';
import {
  boardColumns, keptColumnOrder, movedColumnOrder, orderedColumns, removedColumnOrder,
} from '../components/board/BoardScreen.model';

interface TestRow {
  convId: string;
  title: string;
  lastPreview: string;
  lastTs: number | null;
  unreadCount: number;
  labels?: string[];
  peerAddress?: string | null;
}

function row(convId: string, lastTs: number, labels?: string[]): TestRow {
  return { convId, title: convId, lastPreview: '', lastTs, unreadCount: 0, labels };
}

function dm(convId: string, lastTs: number, labels?: string[]): TestRow {
  return { ...row(convId, lastTs, labels), peerAddress: '0xpeer' };
}

function shape(rows: TestRow[], pinned: string[] = [], order: string[] = []): [string | null, string[]][] {
  return boardColumns(rows, pinned, order).map(c => [c.label, c.rows.map(r => r.convId)]);
}

describe('boardColumns', () => {
  test('one column per label in label bar order, unlabeled channels last', () => {
    const rows = [
      row('plain', 5),
      row('a', 4, ['Todo']),
      row('b', 3, ['Done']),
      row('c', 2, ['Todo']),
    ];
    expect(shape(rows)).toEqual([
      ['Done', ['b']],
      ['Todo', ['a', 'c']],
      [null, ['plain']],
    ]);
  });

  test('labels match case-insensitively and keep the first spelling', () => {
    expect(shape([row('a', 2, ['todo']), row('b', 1, ['Todo'])])).toEqual([['todo', ['a', 'b']], [null, []]]);
  });

  test('a channel with several labels shows in each of their columns', () => {
    expect(shape([row('a', 1, ['Todo', 'Urgent'])])).toEqual([
      ['Todo', ['a']],
      ['Urgent', ['a']],
      [null, []],
    ]);
  });

  test('pinned channels lead each column, the rest are newest first', () => {
    const rows = [row('new', 3, ['Todo']), row('old', 1, ['Todo']), row('mid', 2, ['Todo'])];
    expect(shape(rows, ['old'])).toEqual([['Todo', ['old', 'new', 'mid']], [null, []]]);
  });

  test('an empty label list counts as unlabeled and no rows means no columns', () => {
    expect(shape([row('a', 1, [])])).toEqual([[null, ['a']]]);
    expect(shape([])).toEqual([]);
  });

  test('a label named like the fallback column keeps its own key', () => {
    const keys = boardColumns([row('a', 2, ['unlabeled']), row('b', 1)], [], []).map(c => c.key);
    expect(new Set(keys).size).toBe(2);
  });

  test('every label gets a column, even one whose channels are all hidden', () => {
    const rows = [row('a', 2, ['Todo']), row('b', 1, ['Done'])];
    const columns = boardColumns(rows, [], [], r => r.convId === 'a');
    expect(columns.map(c => [c.label, c.rows.map(r => r.convId)])).toEqual([
      ['Done', ['b']],
      ['Todo', []],
      [null, []],
    ]);
  });

  test('direct messages stay off the board', () => {
    expect(shape([dm('d', 3), dm('e', 2, ['Todo']), row('g', 1, ['Todo'])])).toEqual([
      ['Todo', ['g']],
      [null, []],
    ]);
  });

  test('labels no channel carries any more come back from the saved order and can be removed', () => {
    const columns = boardColumns([row('a', 1, ['Todo'])], [], ['label:Done', 'unlabeled', 'label:todo', 'label:done']);
    expect(columns.map(c => [c.label, c.rows.length, c.removable])).toEqual([
      ['Todo', 1, false],
      ['Done', 0, true],
      [null, 0, false],
    ]);
    expect(shape([], [], ['label:Done'])).toEqual([['Done', []], [null, []]]);
  });
});

describe('saved column order', () => {
  const keys = (order: string[]): string[] =>
    orderedColumns(['label:a', 'label:b', 'label:c', 'unlabeled'].map(key => ({ key })), order).map(c => c.key);

  test('saved columns come first in saved order, new ones follow in their usual order', () => {
    expect(keys([])).toEqual(['label:a', 'label:b', 'label:c', 'unlabeled']);
    expect(keys(['unlabeled', 'label:c'])).toEqual(['unlabeled', 'label:c', 'label:a', 'label:b']);
    expect(keys(['label:gone', 'label:b'])).toEqual(['label:b', 'label:a', 'label:c', 'unlabeled']);
  });

  test('a moved column takes the place of the one it was dropped on', () => {
    const shown = ['label:a', 'label:b', 'label:c'];
    expect(movedColumnOrder(shown, [], 'label:a', 'label:c')).toEqual(['label:b', 'label:c', 'label:a']);
    expect(movedColumnOrder(shown, [], 'label:c', 'label:a')).toEqual(['label:c', 'label:a', 'label:b']);
  });

  test('saved columns that are not on screen keep their place', () => {
    expect(movedColumnOrder(['label:a', 'label:b'], ['label:x', 'label:a', 'label:b'], 'label:b', 'label:a'))
      .toEqual(['label:x', 'label:b', 'label:a']);
    expect(movedColumnOrder(['label:a', 'label:b', 'label:c'], ['label:a', 'label:x', 'label:b'], 'label:a', 'label:b'))
      .toEqual(['label:x', 'label:b', 'label:a', 'label:c']);
  });

  test('saved keys match columns whatever their case, and a move keeps the shown spelling', () => {
    expect(keys(['label:C', 'label:B'])).toEqual(['label:c', 'label:b', 'label:a', 'unlabeled']);
    expect(keys(['label:C', 'label:A', 'label:c'])).toEqual(['label:c', 'label:a', 'label:b', 'unlabeled']);
    expect(movedColumnOrder(['label:Todo', 'label:Done'], ['label:todo', 'label:done'], 'label:Done', 'label:Todo'))
      .toEqual(['label:Done', 'label:Todo']);
  });

  test('ignores drops that change nothing or involve a column that is not on screen', () => {
    const shown = ['label:a', 'label:b'];
    expect(movedColumnOrder(shown, [], 'label:a', 'label:a')).toBeNull();
    expect(movedColumnOrder(shown, [], 'label:a', 'label:x')).toBeNull();
    expect(movedColumnOrder(shown, ['label:x'], 'label:x', 'label:a')).toBeNull();
  });
});

describe('columns left empty', () => {
  const columns = boardColumns([row('a', 3, ['Todo']), row('b', 2, ['Done']), row('c', 1, ['Done'])], [], []);

  test('moving the last card out of a column saves the order so the column stays', () => {
    expect(keptColumnOrder(columns, [], 'label:Todo')).toEqual(['label:Done', 'label:Todo', 'unlabeled']);
    expect(keptColumnOrder(columns, ['label:todo'], 'label:Todo')).toEqual(['label:Todo', 'label:Done', 'unlabeled']);
  });

  test('leaves the order alone when the column keeps cards or is already saved', () => {
    expect(keptColumnOrder(columns, [], 'label:Done')).toBeNull();
    expect(keptColumnOrder(columns, ['label:Done', 'label:Todo', 'unlabeled'], 'label:Todo')).toBeNull();
    expect(keptColumnOrder(boardColumns([row('a', 1)], [], []), [], 'unlabeled')).toBeNull();
  });

  test('removing a column drops it from the saved order whatever its case', () => {
    expect(removedColumnOrder(['label:todo', 'unlabeled', 'label:Done'], 'label:Todo')).toEqual(['unlabeled', 'label:Done']);
  });
});
