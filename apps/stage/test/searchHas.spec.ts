import { describe, expect, test } from 'bun:test';
import { boardColumns, searchedColumns } from '../components/board/BoardScreen.model';
import {
  HAS_OPTIONS, parseSearchFilter, pickSearchFilter, searchFilterMenu, searchFilterValues, searchRowMatcher,
  type FilterOptions, type FilterRow,
} from '../components/searchFilter.model';

const row = (convId: string, labels?: string[]): FilterRow => ({
  convId, title: convId, lastPreview: '', lastTs: 1, unreadCount: 0, labels,
  inboxToAddr: { self: '0xself' }, selfInboxId: 'self',
});

const rows = [
  row('labelled', ['Todo']), row('both', ['Todo', 'Bug']), row('draft'), row('empty', []), row('spaces'), row('attachment'),
];
const drafts: Record<string, string> = { both: ' hello ', draft: '\ntext\n', spaces: ' \n\t ', attachment: '' };
const draftOf = (id: string): string => drafts[id] ?? '';
const namesOf = (): string[] => [];
const matching = (query: string): string[] => (
  rows.filter(searchRowMatcher(parseSearchFilter(query), namesOf, draftOf)).map(item => item.convId)
);
const options: FilterOptions = { has: HAS_OPTIONS, label: [], member: [], category: [], status: [], priority: [] };
const NONE = { labels: [], members: [], categories: [], statuses: [], priorities: [], has: [] };
const menu = (query: string, caret = query.length): ReturnType<typeof searchFilterMenu> => searchFilterMenu(query, caret, options);

function pick(query: string, value: string): ReturnType<typeof pickSearchFilter> {
  const found = menu(query);
  if (found?.kind !== 'values') throw new Error('values expected');
  return pickSearchFilter(query, found, found.options.findIndex(option => option.value === value));
}

describe('has channel filters', () => {
  test('parses has alongside the existing fields and free text', () => {
    expect(parseSearchFilter('HAS:Label,draft has: label:Todo member:@me hello')).toEqual({
      ...NONE, labels: ['Todo'], members: ['@me'], has: ['Label', 'draft'], exclude: NONE, text: 'hello',
    });
    expect(searchFilterValues('has:label has:draft', 'has')).toEqual(['label', 'draft']);
    expect(parseSearchFilter('has:"draft"')).toEqual({
      ...NONE, has: ['draft'], exclude: NONE, text: '',
    });
  });

  test('requires at least one label, not a label with a specific name', () => {
    expect(matching('has:label')).toEqual(['labelled', 'both']);
    expect(matching('HAS:LABEL')).toEqual(['labelled', 'both']);
  });

  test('draft means nonwhitespace local text, not an empty or attachment-only composer', () => {
    expect(matching('has:draft')).toEqual(['both', 'draft']);
    expect(matching('has:DRAFT')).toEqual(['both', 'draft']);
    expect(rows.filter(searchRowMatcher(parseSearchFilter('has:draft'), namesOf))).toEqual([]);
  });

  test('values are OR like existing fields, other fields and free text are AND', () => {
    expect(matching('has:label,draft')).toEqual(['labelled', 'both', 'draft']);
    expect(matching('has:label has:draft')).toEqual(matching('has:label,draft'));
    expect(matching('has:draft label:Todo member:@me bo')).toEqual(['both']);
    expect(matching('has:draft label:Todo member:nobody')).toEqual([]);
    expect(matching('has:label label:Missing')).toEqual([]);
    expect(matching('has:draft nothing')).toEqual([]);
  });

  test('an empty value filters nothing and an unknown value matches nothing', () => {
    expect(matching('has:')).toEqual(rows.map(item => item.convId));
    expect(matching('has:unknown')).toEqual([]);
    expect(matching('has:unknown,draft')).toEqual(['both', 'draft']);
  });

  test('reads current labels and drafts without a network lookup or row snapshot', () => {
    const changing = row('changing');
    let draft = '';
    const hasLabel = searchRowMatcher(parseSearchFilter('has:label'), namesOf);
    const hasDraft = searchRowMatcher(parseSearchFilter('has:draft'), namesOf, () => draft);
    expect(hasLabel(changing)).toBe(false);
    expect(hasDraft(changing)).toBe(false);
    changing.labels = ['Todo'];
    draft = 'text';
    expect(hasLabel(changing)).toBe(true);
    expect(hasDraft(changing)).toBe(true);
    changing.labels = [];
    draft = ' \n ';
    expect(hasLabel(changing)).toBe(false);
    expect(hasDraft(changing)).toBe(false);
  });

  test('board filtering passes local drafts through and keeps empty columns', () => {
    const columns = boardColumns(rows, [], [], 'label');
    expect(searchedColumns(columns, 'has:draft', namesOf, draftOf).map(column => [column.label, column.rows.map(item => item.convId)]))
      .toEqual([['Bug', ['both']], ['Todo', ['both']]]);
    expect(searchedColumns(columns, 'has:draft', namesOf).map(column => column.rows)).toEqual([[], []]);
    expect(searchedColumns(columns, 'has:label', namesOf).map(column => column.rows))
      .toEqual(columns.map(column => column.rows));
  });
});

describe('has suggestions', () => {
  test('offers Has from a prefix and then Label and Draft', () => {
    const field = menu('h');
    expect(field).toMatchObject({ kind: 'fields', fields: ['has'] });
    if (field === null) throw new Error('field expected');
    expect(pickSearchFilter('h', field, 0)).toEqual({ query: 'has:', caret: 4 });
    expect(menu('has:')).toMatchObject({ kind: 'values', field: 'has', options: HAS_OPTIONS });
    expect(HAS_OPTIONS.map(option => [option.value, option.label])).toEqual([['label', 'Label'], ['draft', 'Draft']]);
    expect(menu('has:D')).toMatchObject({ kind: 'values', options: [HAS_OPTIONS[1]] });
    expect(menu('has:nope')).toBeNull();
  });

  test('completes either value and appends to the existing token', () => {
    expect(pick('has:', 'label')).toEqual({ query: 'has:label ', caret: 10 });
    expect(pick('has:d', 'draft')).toEqual({ query: 'has:draft ', caret: 10 });
    expect(pick('has:label,dr', 'draft')).toEqual({ query: 'has:label,draft ', caret: 16 });
    expect(pick('has:label ship has:', 'draft')).toEqual({ query: 'has:label,draft ship ', caret: 21 });
  });

  test('omits selected values case insensitively without treating @ as special', () => {
    expect(menu('has:LABEL has:')).toMatchObject({ kind: 'values', options: [HAS_OPTIONS[1]] });
    expect(menu('has:label,DRAFT,')).toBeNull();
    expect(menu('has:@label has:')).toMatchObject({ kind: 'values', options: HAS_OPTIONS });
    expect(menu('has:draft')).toMatchObject({ kind: 'values', options: [HAS_OPTIONS[1]] });
  });

  test('editing a token in the middle preserves following search text', () => {
    const found = menu('has:dr ship', 6);
    if (found === null) throw new Error('value expected');
    expect(pickSearchFilter('has:dr ship', found, 0)).toEqual({ query: 'has:draft ship', caret: 10 });
  });
});
