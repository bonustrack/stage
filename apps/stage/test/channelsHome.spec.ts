import { describe, expect, test } from 'bun:test';
import { DEFAULT_HOME_VIEW, type HomeViewContent, type HomeViewEdit } from '@stage-labs/client/xmtp/sync/homeView';
import { searchBarLabels } from '../components/home/model';
import {
  homeActivityMenu,
  homeLayoutMenu,
  homeSortMenu,
  homeViewMenu,
  viewMenuContent,
  type ViewMenuSection,
} from '../components/home/viewMenu.model';

function pick(current: HomeViewContent, id: string): HomeViewEdit | null {
  const sections = id.startsWith('view:')
    ? homeLayoutMenu(current)
    : id.startsWith('group:')
      ? homeViewMenu(current, true)
      : homeSortMenu(current);
  const action = sections.flatMap((section) => section.rows).find((row) => row.id === id)?.action;
  return action?.kind === 'edit' ? action.edit : null;
}

describe('filter chips follow the search', () => {
  test('shows labels of matching chats and keeps selected ones', () => {
    expect(searchBarLabels(['Todo', 'Blocked'], new Set(['Done']), [])).toEqual(['Blocked', 'Done', 'Todo']);
    expect(searchBarLabels(['Done'], new Set(['done']), [])).toEqual(['Done']);
  });

  test('follows the board column order, with other labels after it', () => {
    const order = ['label:todo', 'unlabeled', 'label:done'];
    expect(searchBarLabels(['Blocked', 'Done', 'Todo', 'Alpha'], new Set(), order)).toEqual(['Todo', 'Done', 'Alpha', 'Blocked']);
    expect(searchBarLabels(['Todo'], new Set(['done']), order)).toEqual(['Todo', 'done']);
  });
});

describe('the View menu', () => {
  const chats = { view: 'chats', groupBy: 'none', columnBy: 'label', at: 0 } as const;
  const board = { ...chats, view: 'board', groupBy: 'category' } as const;
  const labels = (sections: ViewMenuSection[]): string[][] =>
    sections.map((s) => s.rows.map((r) => `${r.label}${r.value === undefined ? '' : `: ${r.value}`}${r.selected ? '*' : ''}`));

  test('the root starts with the Chats or Board view before the existing options', () => {
    expect(labels(homeViewMenu(chats))).toEqual([['View: Chats', 'Group by: No grouping', 'Sort by: Updated', 'Filter', 'Fields']]);
    expect(labels(homeViewMenu(board))).toEqual([['View: Board', 'Column by: Label', 'Sort by: Priority', 'Filter', 'Fields']]);
    expect(homeViewMenu(chats).every((section) => section.heading === undefined)).toBe(true);
  });

  test('the view picker selects the current layout and edits only the mode', () => {
    expect(labels(homeLayoutMenu(chats))).toEqual([['Chats*', 'Board']]);
    expect(labels(homeLayoutMenu(board))).toEqual([['Chats', 'Board*']]);
    const configured = {
      ...chats,
      chatsSort: { by: 'created', direction: 'asc' },
      boardSort: { by: 'priority', direction: 'desc' },
    } as const;
    const switched = { ...configured, ...pick(configured, 'view:board') };
    expect(switched).toEqual({ ...configured, view: 'board' });
    expect({ ...switched, ...pick(switched, 'view:chats') }).toEqual(configured);
  });

  test('selected values are separate from labels and follow the active mode', () => {
    const current = {
      ...chats,
      groupBy: 'assignee',
      columnBy: 'status',
      chatsSort: { by: 'created', direction: 'asc' },
      boardSort: { by: 'priority', direction: 'desc' },
    } as const;
    for (const view of ['chats', 'board', 'chats'] as const) {
      const rows = homeViewMenu({ ...current, view }).flatMap((section) => section.rows);
      expect(rows.find((row) => row.id === 'grouping')).toMatchObject({
        label: view === 'chats' ? 'Group by' : 'Column by',
        value: view === 'chats' ? 'Assignees' : 'Status',
      });
      expect(rows.find((row) => row.id === 'sorting')).toMatchObject({
        label: 'Sort by',
        value: view === 'chats' ? 'Created' : 'Priority',
        icon: view === 'chats' ? 'IconArrowUp' : 'IconArrowDown',
      });
    }
    for (const [key, value] of [
      ['category', 'Project'],
      ['label', 'Label'],
      ['status', 'Status'],
    ] as const) {
      expect(
        homeViewMenu({ ...chats, groupBy: key })
          .flatMap((section) => section.rows)
          .find((row) => row.id === 'grouping')?.value,
      ).toBe(value);
    }
  });

  test('Last activity keeps its exact choices outside the view root', () => {
    expect(labels(homeActivityMenu('3d'))).toEqual([['1d', '3d*', '7d', '30d', 'All']]);
    for (const view of [chats, board]) {
      expect(
        homeViewMenu(view)
          .flatMap((section) => section.rows)
          .some((row) => row.id === 'activity'),
      ).toBe(false);
    }
  });

  test('Group by uses a distinct grouping icon', () => {
    const rows = homeViewMenu(chats).flatMap((section) => section.rows);
    const icon = rows.find((row) => row.id === 'grouping')?.icon;
    expect(icon).toBeDefined();
    expect(rows.filter((row) => row.id !== 'grouping').every((row) => row.icon !== icon)).toBe(true);
  });

  test('the Chats and Board pages keep independent grouping preferences', () => {
    const grouped = { ...chats, ...pick(chats, 'group:assignee') };
    expect(labels(homeViewMenu({ ...grouped, view: 'board' }))).toEqual([
      ['View: Board', 'Column by: Label', 'Sort by: Priority', 'Filter', 'Fields'],
    ]);
    const columns = { ...grouped, ...pick({ ...grouped, view: 'board' }, 'group:category') };
    expect(labels(homeViewMenu(columns))).toEqual([['View: Chats', 'Group by: Assignees', 'Sort by: Updated', 'Filter', 'Fields']]);
    expect(labels(homeViewMenu({ ...columns, view: 'board' }, true))).toEqual([['Assignees', 'Project*', 'Label', 'Status']]);
  });

  test('chats keeps No grouping inside Group by and marks the current pick', () => {
    const menu = homeViewMenu(chats, true);
    expect(menu.map((s) => s.heading)).toEqual(['Group by']);
    expect(labels(menu)).toEqual([['Assignees', 'Project', 'Label', 'Status', 'No grouping*']]);
  });

  test('the grouping submenu shows Column by for board without No grouping', () => {
    const menu = homeViewMenu(board, true);
    expect(menu.map((s) => s.heading)).toEqual(['Column by']);
    expect(labels(menu)).toEqual([['Assignees', 'Project', 'Label*', 'Status']]);
  });

  test('a pick edits the grouping of chats or the columns of the board, never the page', () => {
    expect(pick(chats, 'group:assignee')).toEqual({ groupBy: 'assignee' });
    expect(pick(chats, 'group:none')).toEqual({ groupBy: 'none' });
    expect(pick(board, 'group:category')).toEqual({ columnBy: 'category' });
    expect(pick(board, 'group:none')).toBeNull();
    expect(pick(chats, 'view:board')).toEqual({ view: 'board' });
    expect(pick(board, 'view:chats')).toEqual({ view: 'chats' });
    expect(pick(chats, 'view:unknown')).toBeNull();
    expect(pick(chats, 'settings')).toBeNull();
  });

  test('root rows open their pages, and each page says how it picks and where back goes', () => {
    expect(homeViewMenu(chats).flatMap((section) => section.rows.map((row) => row.action))).toEqual(
      (['layout', 'grouping', 'sorting', 'filter', 'fields'] as const).map((page) => ({ kind: 'page', page })),
    );
    expect(viewMenuContent('view', chats, 'all')).toMatchObject({ picker: null, back: null });
    expect(viewMenuContent('grouping', board, 'all')).toMatchObject({ picker: null, back: 'view' });
    expect(viewMenuContent('layout', chats, 'all')).toMatchObject({ picker: 'radio', back: 'view' });
    expect(viewMenuContent('sorting', board, 'all')).toMatchObject({ picker: 'checkbox', back: 'view' });
    expect(viewMenuContent('activity', chats, '3d')).toMatchObject({ picker: 'radio', back: 'filter' });
    const week = homeActivityMenu('all')
      .flatMap((section) => section.rows)
      .find((row) => row.label === '7d');
    expect(week?.action).toEqual({ kind: 'activity', window: '7d' });
  });

  test('Sort by offers all four fields and both directions for each mode', () => {
    expect(labels(homeSortMenu(chats))).toEqual([
      ['Status', 'Created', 'Updated*', 'Priority'],
      ['Ascending', 'Descending*'],
    ]);
    expect(labels(homeSortMenu(board))).toEqual([
      ['Status', 'Created', 'Updated', 'Priority*'],
      ['Ascending', 'Descending*'],
    ]);
    for (const current of [chats, board]) {
      const key = current.view === 'board' ? 'boardSort' : 'chatsSort';
      const picked = { ...current, ...pick(current, 'sort:created') };
      expect(picked).toHaveProperty(key, { by: 'created', direction: 'desc' });
      expect(pick(picked, 'direction:asc')).toEqual({ [key]: { by: 'created', direction: 'asc' } });
      expect(pick(current, 'sort:unknown')).toBeNull();
      expect(pick(current, 'direction:down')).toBeNull();
    }
  });

  test('the defaults are the chats list without grouping and a board by status', () => {
    expect(DEFAULT_HOME_VIEW).toEqual({ ...chats, columnBy: 'status' });
    expect(labels(homeViewMenu({ ...DEFAULT_HOME_VIEW, view: 'board' }, true))).toEqual([['Assignees', 'Project', 'Label', 'Status*']]);
    expect(pick(board, 'group:status')).toEqual({ columnBy: 'status' });
  });
});
