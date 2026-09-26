import { describe, expect, test } from 'bun:test';
import { boardColumns, movedColumnOrder, orderedColumns } from '../components/board/BoardScreen.model';

interface TestRow {
  convId: string;
  title: string;
  lastPreview: string;
  lastTs: number | null;
  unreadCount: number;
  labels?: string[];
}

function row(convId: string, lastTs: number, labels?: string[]): TestRow {
  return { convId, title: convId, lastPreview: '', lastTs, unreadCount: 0, labels };
}

function shape(rows: TestRow[], pinned: string[] = []): [string | null, string[]][] {
  return boardColumns(rows, pinned).map(c => [c.label, c.rows.map(r => r.convId)]);
}

describe('boardColumns', () => {
  test('one column per label in label bar order, unlabeled channels last', () => {
    const rows = [
      row('dm', 5),
      row('a', 4, ['Todo']),
      row('b', 3, ['Done']),
      row('c', 2, ['Todo']),
    ];
    expect(shape(rows)).toEqual([
      ['Done', ['b']],
      ['Todo', ['a', 'c']],
      [null, ['dm']],
    ]);
  });

  test('labels match case-insensitively and keep the first spelling', () => {
    expect(shape([row('a', 2, ['todo']), row('b', 1, ['Todo'])])).toEqual([['todo', ['a', 'b']]]);
  });

  test('a channel with several labels shows in each of their columns', () => {
    expect(shape([row('a', 1, ['Todo', 'Urgent'])])).toEqual([
      ['Todo', ['a']],
      ['Urgent', ['a']],
    ]);
  });

  test('pinned channels lead each column, the rest are newest first', () => {
    const rows = [row('new', 3, ['Todo']), row('old', 1, ['Todo']), row('mid', 2, ['Todo'])];
    expect(shape(rows, ['old'])).toEqual([['Todo', ['old', 'new', 'mid']]]);
  });

  test('an empty label list counts as unlabeled and no rows means no columns', () => {
    expect(shape([row('a', 1, [])])).toEqual([[null, ['a']]]);
    expect(shape([])).toEqual([]);
  });

  test('a label named like the fallback column keeps its own key', () => {
    const keys = boardColumns([row('a', 2, ['unlabeled']), row('b', 1)], []).map(c => c.key);
    expect(new Set(keys).size).toBe(2);
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

  test('keeps saved columns that are not on screen and ignores drops that change nothing', () => {
    const shown = ['label:a', 'label:b'];
    expect(movedColumnOrder(shown, ['label:gone', 'label:a'], 'label:b', 'label:a'))
      .toEqual(['label:b', 'label:a', 'label:gone']);
    expect(movedColumnOrder(shown, [], 'label:a', 'label:a')).toBeNull();
    expect(movedColumnOrder(shown, [], 'label:a', 'label:x')).toBeNull();
  });
});
