import { describe, expect, test } from 'bun:test';
import { boardColumns, searchedColumns } from '../components/board/BoardScreen.model';
import {
  FILTER_FIELDS, PRIORITY_OPTIONS, parseSearchFilter, searchFilterSources, searchFilterToken, searchFilterValues, searchRowMatcher,
  type FilterRow,
} from '../components/searchFilter.model';
import { ALICE, BOB, NAMES, group } from './searchFixtures';

const rows: FilterRow[] = [
  { ...group('build', ['Bug'], [ALICE]), category: 'Stage', status: 'Backlog', priority: 'High' },
  { ...group('ship', ['Bug'], [BOB]), category: 'Stage', status: '🚧 In progress', priority: 'Urgent' },
  { ...group('plan', [], [ALICE, BOB]), category: 'Snapshot', status: 'Todo', priority: 'Low' },
  { ...group('review', [], [BOB]), category: 'Client work', status: 'Ready, next', priority: 'Medium' },
  group('missing', ['Todo']),
  { ...group('empty', []), category: '  ', status: '', priority: null },
];
const namesOf = (address: string): string[] => NAMES[address] ?? [];
const draftOf = (convId: string): string => convId === 'ship' ? 'release' : '';
const matching = (query: string): string[] => (
  rows.filter(searchRowMatcher(parseSearchFilter(query), namesOf, draftOf)).map(row => row.convId)
);

describe('channel metadata search filters', () => {
  test('parses field names without case, commas, repeated tokens and unfinished quotes', () => {
    expect(parseSearchFilter('CATEGORY:Stage,"Client work" STATUS:Backlog status:"🚧 In progress" PRIORITY:High,Urgent ship')).toMatchObject({
      categories: ['Stage', 'Client work'], statuses: ['Backlog', '🚧 In progress'], priorities: ['High', 'Urgent'], text: 'ship',
    });
    expect(parseSearchFilter('status:"🚧 In').statuses).toEqual(['🚧 In']);
    expect(parseSearchFilter('category:"Client work", category:Stage').categories).toEqual(['Client work', 'Stage']);
  });

  test('quotes whitespace and commas without removing status emoji', () => {
    const statuses = ['Backlog', 'Todo', '🚧 In progress', 'Ready, next'];
    const token = searchFilterToken('status', statuses);
    expect(token).toBe('status:Backlog,Todo,"🚧 In progress","Ready, next"');
    expect(parseSearchFilter(token).statuses).toEqual(statuses);
    expect(parseSearchFilter(searchFilterToken('category', ['Client work', 'a,b'])).categories).toEqual(['Client work', 'a,b']);
    expect(searchFilterToken('priority', ['High', 'Low'])).toBe('priority:High,Low');
  });

  test('matches exact metadata values without guessing statuses or falling back to labels', () => {
    expect(matching('category:stage')).toEqual(['build', 'ship']);
    expect(matching('status:backlog')).toEqual(['build']);
    expect(matching('status:Todo')).toEqual(['plan']);
    expect(matching('status:"🚧 in progress"')).toEqual(['ship']);
    expect(matching('status:"In progress"')).toEqual([]);
    expect(matching('status:"Ready, next" category:"Client work"')).toEqual(['review']);
    expect(matching('priority:high,URGENT')).toEqual(['build', 'ship']);
    expect(matching('priority:Unknown')).toEqual([]);
    expect(matching('status:"No status"')).toEqual([]);
    expect(matching('category:"No category"')).toEqual([]);
  });

  test('ORs values within fields and ANDs metadata with existing tokens and free text', () => {
    expect(matching('status:Backlog,Todo')).toEqual(['build', 'plan']);
    expect(matching('category:Stage category:Snapshot')).toEqual(['build', 'ship', 'plan']);
    expect(matching('category:Stage status:Backlog,"🚧 In progress" priority:Urgent label:Bug member:bob.base.eth has:draft shi'))
      .toEqual(['ship']);
    expect(matching('category:Stage priority:Low')).toEqual([]);
    expect(matching('status:Backlog priority:High -category:Stage')).toEqual([]);
  });

  test('supports excluded category, status and priority values', () => {
    expect(matching('-category:Stage -status:Todo -priority:Medium')).toEqual(['missing', 'empty']);
    expect(matching('category:Stage -status:Backlog')).toEqual(['ship']);
    expect(matching('-priority:High,Urgent')).toEqual(['plan', 'review', 'missing', 'empty']);
    expect(searchFilterValues('status:Backlog -status:Todo,"Ready, next"', 'status')).toEqual(['Backlog', 'Todo', 'Ready, next']);
  });

  test('empty values and clearing the query remove only the query restrictions', () => {
    expect(matching('category: status:"" priority: -category: -status: -priority:')).toEqual(rows.map(row => row.convId));
    expect(matching('category:Stage')).toEqual(['build', 'ship']);
    expect(matching('')).toEqual(rows.map(row => row.convId));
    expect(rows[0]).toMatchObject({ category: 'Stage', status: 'Backlog', priority: 'High' });
  });

  test('the shared matcher reads current metadata after it changes or clears', () => {
    const row: FilterRow = { ...group('changing', []), category: 'Stage', status: 'Backlog', priority: 'High' };
    const matches = searchRowMatcher(parseSearchFilter('category:Stage status:Backlog priority:High'), namesOf);
    expect(matches(row)).toBe(true);
    row.status = 'Todo';
    expect(matches(row)).toBe(false);
    row.status = 'Backlog';
    row.category = null;
    expect(matches(row)).toBe(false);
    row.category = 'Stage';
    row.priority = null;
    expect(matches(row)).toBe(false);
  });

  test('board columns use the same combined filter in each supported metadata grouping', () => {
    for (const by of ['status', 'category', 'label'] as const) {
      const columns = boardColumns(rows, [], [], by);
      const shown = searchedColumns(columns, 'category:Stage status:Backlog priority:High label:Bug member:alice123', namesOf);
      expect(shown.map(column => column.key)).toEqual(columns.map(column => column.key));
      expect(shown.flatMap(column => column.rows.map(row => row.convId))).toEqual(['build']);
    }
  });
});

describe('metadata filter suggestions', () => {
  test('lists fields in right-panel order with Has last', () => {
    expect(FILTER_FIELDS).toEqual(['member', 'category', 'status', 'priority', 'label', 'has']);
  });

  test('collects real categories and freeform statuses, including unlabelled board cards', () => {
    const duplicate: FilterRow = { ...group('duplicate', []), category: 'stage', status: 'backlog' };
    const dm: FilterRow = { ...group('dm', []), peerAddress: BOB, category: 'Private', status: 'DM only' };
    const board = searchFilterSources([...rows, duplicate, dm], 'board');
    expect(board.categories).toEqual(['Client work', 'Snapshot', 'Stage']);
    expect(board.statuses).toEqual(['🚧 In progress', 'Backlog', 'Ready, next', 'Todo']);
    expect(searchFilterSources(rows.filter(row => row.convId === 'missing' || row.convId === 'empty'), 'board'))
      .toMatchObject({ categories: [], statuses: [] });
    expect(searchFilterSources([dm], 'chats')).toMatchObject({ categories: ['Private'], statuses: ['DM only'] });
  });

  test('uses the fixed priority values in their existing order', () => {
    expect(PRIORITY_OPTIONS.map(option => [option.label, option.value])).toEqual([
      ['Urgent', 'Urgent'], ['High', 'High'], ['Medium', 'Medium'], ['Low', 'Low'],
    ]);
  });

  test('an unseen status matches nothing', () => {
    expect(matching('status:NeverSeen')).toEqual([]);
  });
});
