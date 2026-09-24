import { describe, expect, test } from 'bun:test';
import { searchBarLabels } from '../components/home/model';

describe('filter chips follow the search', () => {
  test('shows labels of matching chats and keeps selected ones', () => {
    expect(searchBarLabels(['Todo', 'Blocked'], new Set(['Done']))).toEqual(['Blocked', 'Done', 'Todo']);
    expect(searchBarLabels(['Done'], new Set(['done']))).toEqual(['Done']);
  });
});
