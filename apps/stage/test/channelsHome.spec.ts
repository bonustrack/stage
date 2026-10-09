import { describe, expect, test } from 'bun:test';
import { DEFAULT_HOME_VIEW } from '@stage-labs/client/xmtp/readState';
import {
  CHANNELS_OVERFLOW_ITEMS, homeSortMenu, homeViewEdit, homeViewMenu, searchBarLabels, type ViewMenuSection,
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
  const labels = (sections: ViewMenuSection[]): string[][] => sections.map(s => s.rows.map(r => `${r.label}${r.value === undefined ? '' : `: ${r.value}`}${r.selected ? '*' : ''}`));

  test('the root holds only the submenu entries of its page, with no Chats or Board choice', () => {
    expect(labels(homeViewMenu(chats))).toEqual([['Group by: No grouping', 'Sort by: Updated', 'Filter', 'Fields']]);
    expect(labels(homeViewMenu(board))).toEqual([['Column by: Label', 'Sort by: Priority', 'Filter', 'Fields']]);
    expect(homeViewMenu(chats).every(section => section.heading === undefined)).toBe(true);
  });

  test('selected values are separate from labels and follow the active mode', () => {
    const current = {
      ...chats, groupBy: 'assignee', columnBy: 'status',
      chatsSort: { by: 'created', direction: 'asc' }, boardSort: { by: 'priority', direction: 'desc' },
    } as const;
    for (const view of ['chats', 'board', 'chats'] as const) {
      const rows = homeViewMenu({ ...current, view }).flatMap(section => section.rows);
      expect(rows.find(row => row.id === 'grouping')).toMatchObject({
        label: view === 'chats' ? 'Group by' : 'Column by', value: view === 'chats' ? 'Assignees' : 'Status',
      });
      expect(rows.find(row => row.id === 'sorting')).toMatchObject({
        label: 'Sort by', value: view === 'chats' ? 'Created' : 'Priority',
        icon: view === 'chats' ? 'IconArrowUp' : 'IconArrowDown',
      });
    }
    for (const [key, value] of [['category', 'Project'], ['label', 'Label'], ['status', 'Status']] as const) {
      expect(homeViewMenu({ ...chats, groupBy: key }).flatMap(section => section.rows)
        .find(row => row.id === 'grouping')?.value).toBe(value);
    }
  });

  test('Group by uses a distinct grouping icon', () => {
    const rows = homeViewMenu(chats).flatMap(section => section.rows);
    const icon = rows.find(row => row.id === 'grouping')?.icon;
    expect(icon).toBe('IconLayersThree');
    expect(rows.filter(row => row.id !== 'grouping').every(row => row.icon !== icon)).toBe(true);
  });

  test('the Chats and Board pages keep independent grouping preferences', () => {
    const grouped = { ...chats, ...homeViewEdit(chats, 'group:assignee') };
    expect(labels(homeViewMenu({ ...grouped, view: 'board' }))).toEqual([['Column by: Label', 'Sort by: Priority', 'Filter', 'Fields']]);
    const columns = { ...grouped, ...homeViewEdit({ ...grouped, view: 'board' }, 'group:category') };
    expect(labels(homeViewMenu(columns))).toEqual([['Group by: Assignees', 'Sort by: Updated', 'Filter', 'Fields']]);
    expect(labels(homeViewMenu({ ...columns, view: 'board' }, true))).toEqual([['Assignees', 'Project*', 'Label', 'Status']]);
  });

  test('chats keeps No grouping inside Group by and marks the current pick', () => {
    const menu = homeViewMenu(chats, true);
    expect(menu.map(s => s.heading)).toEqual(['Group by']);
    expect(labels(menu)).toEqual([['Assignees', 'Project', 'Label', 'Status', 'No grouping*']]);
  });

  test('the grouping submenu shows Column by for board without No grouping', () => {
    const menu = homeViewMenu(board, true);
    expect(menu.map(s => s.heading)).toEqual(['Column by']);
    expect(labels(menu)).toEqual([['Assignees', 'Project', 'Label*', 'Status']]);
  });

  test('a pick edits the grouping of chats or the columns of the board, never the page', () => {
    expect(homeViewEdit(chats, 'group:assignee')).toEqual({ groupBy: 'assignee' });
    expect(homeViewEdit(chats, 'group:none')).toEqual({ groupBy: 'none' });
    expect(homeViewEdit(board, 'group:category')).toEqual({ columnBy: 'category' });
    expect(homeViewEdit(board, 'group:none')).toBeNull();
    expect(homeViewEdit(chats, 'view:board')).toBeNull();
    expect(homeViewEdit(board, 'view:chats')).toBeNull();
    expect(homeViewEdit(chats, 'settings')).toBeNull();
  });

  test('Sort by offers all four fields and both directions for each mode', () => {
    expect(labels(homeSortMenu(chats))).toEqual([['Status', 'Created', 'Updated*', 'Priority'], ['Ascending', 'Descending*']]);
    expect(labels(homeSortMenu(board))).toEqual([['Status', 'Created', 'Updated', 'Priority*'], ['Ascending', 'Descending*']]);
    for (const current of [chats, board]) {
      const key = current.view === 'board' ? 'boardSort' : 'chatsSort';
      const picked = { ...current, ...homeViewEdit(current, 'sort:created') };
      expect(picked).toHaveProperty(key, { by: 'created', direction: 'desc' });
      expect(homeViewEdit(picked, 'direction:asc')).toEqual({ [key]: { by: 'created', direction: 'asc' } });
      expect(homeViewEdit(current, 'sort:unknown')).toBeNull();
      expect(homeViewEdit(current, 'direction:down')).toBeNull();
    }
  });

  test('the defaults are the chats list without grouping and a board by status', () => {
    expect(DEFAULT_HOME_VIEW).toEqual({ ...chats, columnBy: 'status' });
    expect(labels(homeViewMenu({ ...DEFAULT_HOME_VIEW, view: 'board' }, true)))
      .toEqual([['Assignees', 'Project', 'Label', 'Status*']]);
    expect(homeViewEdit(board, 'group:status')).toEqual({ columnBy: 'status' });
    expect(CHANNELS_OVERFLOW_ITEMS.map(item => item.label)).toEqual(['View', 'Copy address', 'Profile', 'Settings']);
  });
});
