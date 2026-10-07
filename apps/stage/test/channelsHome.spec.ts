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
    expect(labels(homeViewMenu(board))).toEqual([['Chats', 'Board*'], ['Column by', 'Filter', 'Fields']]);
    expect(homeViewMenu(chats).every(section => section.heading === undefined)).toBe(true);
  });

  test('Group by uses a distinct grouping icon', () => {
    const rows = homeViewMenu(chats).flatMap(section => section.rows);
    const icon = rows.find(row => row.id === 'grouping')?.icon;
    expect(icon).toBe('IconLayersThree');
    expect(rows.filter(row => row.id !== 'grouping').every(row => row.icon !== icon)).toBe(true);
  });

  test('both mode transitions refresh selection and retain independent grouping preferences', () => {
    const next = { ...chats, ...homeViewEdit(chats, 'view:board') };
    expect(labels(homeViewMenu(next))).toEqual([['Chats', 'Board*'], ['Column by', 'Filter', 'Fields']]);
    expect(homeViewMenu(next, true).map(section => section.heading)).toEqual(['Column by']);
    expect(labels(homeViewMenu(next, true))).toEqual([['Assignees', 'Category', 'Label*', 'Status']]);
    const back = { ...next, ...homeViewEdit(next, 'view:chats') };
    expect(labels(homeViewMenu(back))).toEqual([['Chats*', 'Board'], ['Group by', 'Filter', 'Fields']]);
    expect(homeViewMenu(back, true).map(section => section.heading)).toEqual(['Group by']);
    expect(labels(homeViewMenu(back, true))).toEqual([['Assignees', 'Category', 'Label', 'Status', 'No grouping*']]);
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
