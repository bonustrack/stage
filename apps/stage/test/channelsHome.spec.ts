import { describe, expect, test } from 'bun:test';
import { searchBarLabels } from '../components/home/model';

describe('filter chips follow the search', () => {
  test('shows labels of matching chats and keeps selected ones', () => {
    expect(searchBarLabels(['Todo', 'Blocked'], new Set(['Done']), [])).toEqual(['Blocked', 'Done', 'Todo']);
    expect(searchBarLabels(['Done'], new Set(['done']), [])).toEqual(['Done']);
  });

  test('follows the board column order, with other labels after it', () => {
    const order = ['label:todo', 'unlabeled', 'label:done'];
    expect(searchBarLabels(['Blocked', 'Done', 'Todo', 'Alpha'], new Set(), order))
      .toEqual(['Todo', 'Done', 'Alpha', 'Blocked']);
    expect(searchBarLabels(['Todo'], new Set(['done']), order)).toEqual(['Todo', 'done']);
  });
});
