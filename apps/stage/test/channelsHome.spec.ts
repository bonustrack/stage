import { describe, expect, test } from 'bun:test';
import { DEFAULT_HOME_VIEW } from '@stage-labs/client/xmtp/readState';
import {
  CHANNELS_OVERFLOW_ITEMS, homeViewEdit, homeViewMenu, searchBarLabels, type ViewMenuSection,
} from '../components/home/model';

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

describe('the View menu', () => {
  const chats = { view: 'chats', groupBy: 'none', columnBy: 'label', at: 0 } as const;
  const board = { ...chats, view: 'board', groupBy: 'category' } as const;
  const labels = (sections: ViewMenuSection[]): string[][] => sections.map(s => s.rows.map(r => `${r.label}${r.selected ? '*' : ''}`));

  test('the root contains view choices and submenu entries, not grouping options', () => {
    expect(labels(homeViewMenu(chats))).toEqual([['Chats*', 'Board'], ['Group by', 'Filter', 'Fields']]);
    expect(labels(homeViewMenu(board))).toEqual([['Chats', 'Board*'], ['Group by', 'Filter', 'Fields']]);
    expect(homeViewMenu(chats).every(section => section.heading === undefined)).toBe(true);
  });

  test('chats keeps No grouping inside Group by and marks the current pick', () => {
    const menu = homeViewMenu(chats, true);
    expect(menu.map(s => s.heading)).toEqual(['Group by']);
    expect(labels(menu)).toEqual([['Assignees', 'Category', 'Label', 'Status', 'No grouping*']]);
  });

  test('the grouping submenu shows Column by for board without No grouping', () => {
    const menu = homeViewMenu(board, true);
    expect(menu.map(s => s.heading)).toEqual(['Column by']);
    expect(labels(menu)).toEqual([['Assignees', 'Category', 'Label*', 'Status']]);
  });

  test('a pick edits the view, the grouping of chats or the columns of the board', () => {
    expect(homeViewEdit(chats, 'view:board')).toEqual({ view: 'board' });
    expect(homeViewEdit(board, 'view:chats')).toEqual({ view: 'chats' });
    expect(homeViewEdit(chats, 'group:assignee')).toEqual({ groupBy: 'assignee' });
    expect(homeViewEdit(chats, 'group:none')).toEqual({ groupBy: 'none' });
    expect(homeViewEdit(board, 'group:category')).toEqual({ columnBy: 'category' });
    expect(homeViewEdit(board, 'group:none')).toBeNull();
    expect(homeViewEdit(chats, 'view:table')).toBeNull();
    expect(homeViewEdit(chats, 'settings')).toBeNull();
  });

  test('the defaults are the chats list without grouping and a board by status', () => {
    expect(DEFAULT_HOME_VIEW).toEqual({ ...chats, columnBy: 'status' });
    expect(labels(homeViewMenu({ ...DEFAULT_HOME_VIEW, view: 'board' }, true)))
      .toEqual([['Assignees', 'Category', 'Label', 'Status*']]);
    expect(homeViewEdit(board, 'group:status')).toEqual({ columnBy: 'status' });
    expect(CHANNELS_OVERFLOW_ITEMS.map(item => item.label)).toEqual(['View', 'Copy address', 'Profile', 'Settings']);
  });
});
