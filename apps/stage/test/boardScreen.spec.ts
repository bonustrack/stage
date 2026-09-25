import { describe, expect, test } from 'bun:test';
import { BOARD_GAP, boardColumnWidth, boardColumns } from '../components/board/BoardScreen.model';

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
    const rows = [row('old', 1, ['Todo']), row('new', 3, ['Todo']), row('mid', 2, ['Todo'])];
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

describe('boardColumnWidth', () => {
  test('columns share the width when they all fit on one line', () => {
    expect(boardColumnWidth(1200, 3)).toBe(Math.floor((1200 - 2 * BOARD_GAP) / 3));
    expect(boardColumnWidth(1200, 1)).toBe(1200);
  });

  test('columns wrap once they would drop below the minimum width', () => {
    const width = boardColumnWidth(1000, 6);
    expect(width).toBe(Math.floor((1000 - 2 * BOARD_GAP) / 3));
  });

  test('a phone width stacks the columns', () => {
    expect(boardColumnWidth(300, 4)).toBe(300);
    expect(boardColumnWidth(200, 4)).toBe(200);
  });

  test('nothing is sized before the board has been measured', () => {
    expect(boardColumnWidth(0, 3)).toBeNull();
    expect(boardColumnWidth(800, 0)).toBeNull();
  });
});
