import { describe, expect, test } from 'bun:test';
import {
  addColumnProblem, addedColumnOrder, boardColumns, deleteColumnConfirm, deletedColumnOrder, draftEdit, draftNote,
  addItemRows, keptColumnOrder, labelCarriers, movedColumnOrder, namedBoardOrder, orderedColumns, renameEdit, renameNote,
  renameProblem, renameTarget, renamedColumnOrder,
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

function shape(rows: TestRow[], pinned: string[] = [], order: string[] = []): [string, string[]][] {
  return boardColumns(rows, pinned, order).map(c => [c.label, c.rows.map(r => r.convId)]);
}

describe('boardColumns', () => {
  test('one column per label in label bar order, and channels with no label stay off the board', () => {
    const rows = [
      row('plain', 5),
      row('a', 4, ['Todo']),
      row('b', 3, ['Done']),
      row('c', 2, ['Todo']),
    ];
    expect(shape(rows)).toEqual([
      ['Done', ['b']],
      ['Todo', ['a', 'c']],
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

  test('no label means no columns, whatever the channels', () => {
    expect(shape([row('a', 2, []), row('b', 1)])).toEqual([]);
    expect(shape([])).toEqual([]);
  });

  test('a label named Unlabeled is a column like any other', () => {
    expect(shape([row('a', 2, ['Unlabeled']), row('b', 1)])).toEqual([['Unlabeled', ['a']]]);
  });

  test('every label gets a column, even one whose channels are all hidden', () => {
    const rows = [row('a', 2, ['Todo']), row('b', 1, ['Done'])];
    const columns = boardColumns(rows, [], [], r => r.convId === 'a');
    expect(columns.map(c => [c.label, c.rows.map(r => r.convId)])).toEqual([
      ['Done', ['b']],
      ['Todo', []],
    ]);
  });

  test('direct messages stay off the board', () => {
    expect(shape([dm('d', 3), dm('e', 2, ['Todo']), row('g', 1, ['Todo'])])).toEqual([
      ['Todo', ['g']],
    ]);
  });

  test('labels no channel carries any more come back from the saved order', () => {
    expect(shape([row('a', 1, ['Todo'])], [], ['label:Done', 'unlabeled', 'label:todo', 'label:done'])).toEqual([
      ['Todo', ['a']],
      ['Done', []],
    ]);
    expect(shape([], [], ['label:Done'])).toEqual([['Done', []]]);
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
    expect(keptColumnOrder(columns, [], 'label:Todo')).toEqual(['label:Done', 'label:Todo']);
    expect(keptColumnOrder(columns, ['label:todo'], 'label:Todo')).toEqual(['label:Todo', 'label:Done']);
  });

  test('leaves the order alone when the column keeps cards or is already saved', () => {
    expect(keptColumnOrder(columns, [], 'label:Done')).toBeNull();
    expect(keptColumnOrder(columns, ['label:Done', 'label:Todo'], 'label:Todo')).toBeNull();
    expect(keptColumnOrder(columns, [], 'label:Gone')).toBeNull();
  });
});

describe('adding channels to a column', () => {
  test('lists the groups without the label whatever its case, newest first', () => {
    const rows = [row('a', 4, ['todo']), row('b', 3, ['Done']), row('c', 5), dm('d', 6), row('e', 1, ['TODO', 'Done'])];
    expect(addItemRows(rows, 'Todo', '', []).map(r => r.convId)).toEqual(['c', 'b']);
  });

  test('the search matches the name in any case and keeps picked channels listed', () => {
    const rows = [row('Alpha', 3), row('beta', 2), row('Gamma', 1)];
    expect(addItemRows(rows, 'Todo', ' AL ', []).map(r => r.convId)).toEqual(['Alpha']);
    expect(addItemRows(rows, 'Todo', 'al', ['Gamma']).map(r => r.convId)).toEqual(['Alpha', 'Gamma']);
    expect(addItemRows(rows, 'Todo', 'zzz', [])).toEqual([]);
  });
});

describe('renaming a column', () => {
  const columns = boardColumns([row('a', 3, ['Todo']), row('b', 2, ['Done']), row('c', 1)], [], []);
  const keys = columns.map(c => c.key);

  test('a rename reaches every group carrying the name whatever its case, direct messages aside', () => {
    const rows = [row('a', 4, ['Urgent', 'todo']), row('b', 3, ['TODO']), row('c', 2, ['Done']), dm('d', 1, ['Todo'])];
    expect(labelCarriers(rows, 'Todo')).toEqual(['a', 'b']);
  });

  test('a new name must be set and short enough', () => {
    expect(renameProblem('  ')).toBe('Enter a name.');
    expect(renameProblem('x'.repeat(25))).toBe('Use at most 24 characters.');
    expect(renameProblem(` ${'x'.repeat(24)} `)).toBeNull();
    expect(renameProblem('Doing')).toBeNull();
  });

  test('a name another column has merges into that column with its spelling', () => {
    expect(renameTarget(columns, 'Todo', ' done ')).toEqual({ name: 'Done', merge: true });
    expect(renameTarget(columns, 'Todo', 'Doing  now')).toEqual({ name: 'Doing now', merge: false });
    expect(renameTarget(columns, 'Todo', 'TODO')).toEqual({ name: 'TODO', merge: false });
  });

  test('the renamed column keeps its place in the saved order', () => {
    expect(renamedColumnOrder(keys, [], 'Todo', 'Doing')).toEqual(['label:Done', 'label:Doing']);
    expect(renamedColumnOrder(keys, ['label:Later', 'label:todo'], 'Todo', 'Doing'))
      .toEqual(['label:Later', 'label:Doing', 'label:Done']);
  });

  test('a rename that only changes the case keeps the column in place', () => {
    expect(renamedColumnOrder(keys, [], 'Todo', 'TODO')).toEqual(['label:Done', 'label:TODO']);
  });

  test('a merged column leaves the saved order where the other column already is', () => {
    expect(renamedColumnOrder(keys, ['label:todo', 'label:Later', 'label:done'], 'Todo', 'Done'))
      .toEqual(['label:Later', 'label:Done']);
  });
});

describe('deleting a column', () => {
  const keys = boardColumns([row('a', 3, ['Todo']), row('b', 2, ['Done']), row('c', 1)], [], []).map(c => c.key);

  test('the deleted column leaves the saved order and the others keep their place', () => {
    expect(deletedColumnOrder(keys, [], 'Todo')).toEqual(['label:Done']);
    expect(deletedColumnOrder(keys, ['label:Later', 'label:todo', 'label:Done'], 'Todo'))
      .toEqual(['label:Later', 'label:Done']);
  });

  test('a remembered column with no channel leaves the saved order whatever its case', () => {
    const saved = ['label:Done', 'label:Later', 'label:Todo'];
    const shown = boardColumns([row('b', 2, ['Done'])], [], saved).map(c => c.key);
    expect(deletedColumnOrder(shown, saved, 'later')).toEqual(['label:Done', 'label:Todo']);
  });

  test('the confirmation names how many channels lose the label', () => {
    const moved = 'Channels with no other label leave the board.';
    expect(deleteColumnConfirm('Todo', 3)).toEqual({
      title: 'Delete column', message: `This removes the Todo label from 3 channels. ${moved}`,
    });
    expect(deleteColumnConfirm('Todo', 1).message).toBe(`This removes the Todo label from 1 channel. ${moved}`);
    expect(deleteColumnConfirm('Todo', 0).message).toBe('No channel has the Todo label.');
  });
});

describe('adding a column', () => {
  const rows = [row('a', 3, ['Todo']), row('b', 2, ['Done']), row('c', 1)];
  const columns = boardColumns(rows, [], []);
  const keys = columns.map(c => c.key);

  test('a new name must be set, short enough and not taken by any column whatever its case', () => {
    expect(addColumnProblem(columns, '  ')).toBe('Enter a name.');
    expect(addColumnProblem(columns, 'x'.repeat(25))).toBe('Use at most 24 characters.');
    expect(addColumnProblem(columns, ' todo ')).toBe('A column named Todo already exists.');
    expect(addColumnProblem(columns, 'Unlabeled')).toBeNull();
    expect(addColumnProblem(columns, 'Doing')).toBeNull();
  });

  test('the new column goes last in the saved order with the typed spelling', () => {
    expect(addedColumnOrder(keys, [], ' Blocked  now ')).toEqual(['label:Done', 'label:Todo', 'label:Blocked now']);
    expect(addedColumnOrder(keys, ['label:Later', 'label:todo'], 'Blocked'))
      .toEqual(['label:Later', 'label:Todo', 'label:Done', 'label:Blocked']);
  });

  test('the added column shows empty at the far right of the board', () => {
    const order = addedColumnOrder(keys, [], 'Blocked');
    expect(orderedColumns(boardColumns(rows, [], order), order).map(c => [c.label, c.rows.length]))
      .toEqual([['Done', 1], ['Todo', 1], ['Blocked', 0]]);
  });
});

describe('typing a column title in place', () => {
  const columns = boardColumns([row('a', 3, ['Todo']), row('b', 2, ['Done']), row('c', 1)], [], []);
  const long = 'x'.repeat(25);

  test('a new column saves its typed name with Enter or on blur', () => {
    expect(draftEdit(columns, ' Blocked  now ', 'enter')).toEqual({ kind: 'save', name: 'Blocked now' });
    expect(draftEdit(columns, 'Blocked', 'blur')).toEqual({ kind: 'save', name: 'Blocked' });
  });

  test('a new column left empty goes away on blur and waits for a name on Enter', () => {
    expect(draftEdit(columns, '  ', 'blur')).toEqual({ kind: 'close' });
    expect(draftEdit(columns, '', 'enter')).toEqual({ kind: 'stay' });
  });

  test('a new column with a taken or long name stays open', () => {
    expect(draftEdit(columns, 'todo', 'blur')).toEqual({ kind: 'stay' });
    expect(draftEdit(columns, 'DONE', 'enter')).toEqual({ kind: 'stay' });
    expect(draftEdit(columns, long, 'blur')).toEqual({ kind: 'stay' });
  });

  test('a new column says what is wrong once there is a name or a try', () => {
    expect(draftNote(columns, '', false)).toBeNull();
    expect(draftNote(columns, '', true)).toBe('Enter a name.');
    expect(draftNote(columns, 'todo', false)).toBe('A column named Todo already exists.');
    expect(draftNote(columns, 'Doing', true)).toBeNull();
  });

  test('a rename saves with Enter or on blur, into the spelling of a column it merges with', () => {
    expect(renameEdit(columns, 'Todo', ' Doing ', 'blur')).toEqual({ kind: 'save', name: 'Doing' });
    expect(renameEdit(columns, 'Todo', 'done', 'enter')).toEqual({ kind: 'save', name: 'Done' });
    expect(renameEdit(columns, 'Todo', 'TODO', 'enter')).toEqual({ kind: 'save', name: 'TODO' });
  });

  test('a rename to the same name closes without saving', () => {
    expect(renameEdit(columns, 'Todo', ' Todo ', 'enter')).toEqual({ kind: 'close' });
    expect(renameEdit(columns, 'Todo', 'Todo', 'blur')).toEqual({ kind: 'close' });
  });

  test('an empty or long rename reverts on blur and waits for a fix on Enter', () => {
    expect(renameEdit(columns, 'Todo', ' ', 'blur')).toEqual({ kind: 'close' });
    expect(renameEdit(columns, 'Todo', ' ', 'enter')).toEqual({ kind: 'stay' });
    expect(renameEdit(columns, 'Todo', long, 'blur')).toEqual({ kind: 'close' });
    expect(renameEdit(columns, 'Todo', long, 'enter')).toEqual({ kind: 'stay' });
  });

  test('a rename says what is wrong once there is a name or a try, and where a merge takes the channels', () => {
    expect(renameNote(columns, 'Todo', '', false)).toBeNull();
    expect(renameNote(columns, 'Todo', '', true)).toBe('Enter a name.');
    expect(renameNote(columns, 'Todo', long, false)).toBe('Use at most 24 characters.');
    expect(renameNote(columns, 'Todo', 'done', false)).toBe('Channels move into the Done column.');
    expect(renameNote(columns, 'Todo', 'Doing', true)).toBeNull();
  });
});

describe('board order saved with label ids', () => {
  const registry = JSON.stringify([
    { id: 'todo', name: 'Doing', aliases: ['Todo'], at: 5 },
    { id: 'todo~2', name: 'Todo', aliases: [], at: 6 },
    { id: 'done', name: 'Done', aliases: [], at: 0 },
    { id: 'backlog', name: 'Later', aliases: ['Backlog'], at: 3 },
  ]);

  test('turns every id back into the label name', () => {
    expect(namedBoardOrder(['label:todo~2', 'unlabeled', 'label:todo', 'label:done'], registry))
      .toEqual(['label:Todo', 'unlabeled', 'label:Doing', 'label:Done']);
  });

  test('keeps keys it does not know and drops the ones that end up twice', () => {
    expect(namedBoardOrder(['label:Blocked', 'label:done', 'label:Done'], registry)).toEqual(['label:Blocked', 'label:Done']);
  });

  test('reads a key in another case as a label name first and as an id after', () => {
    expect(namedBoardOrder(['label:Todo', 'label:Backlog', 'label:DONE', 'label:Doing', 'unlabeled'], registry))
      .toEqual(['label:Todo', 'label:Later', 'label:Done', 'label:Doing', 'unlabeled']);
  });

  test('leaves the order alone when the saved ids cannot be read', () => {
    const order = ['label:todo', 'unlabeled'];
    expect(namedBoardOrder(order, '{')).toEqual(order);
    expect(namedBoardOrder(order, '{"id":"todo","name":"Doing"}')).toEqual(order);
    expect(namedBoardOrder(['label:1', 'label:todo'], '[{"id":"todo"},{"id":1,"name":"Doing"}]'))
      .toEqual(['label:1', 'label:todo']);
  });
});
