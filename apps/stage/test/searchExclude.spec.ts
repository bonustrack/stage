import { describe, expect, test } from 'bun:test';
import {
  HAS_OPTIONS, ME_OPTION, filterMenuSize, parseSearchFilter, pickSearchFilter, searchFilterMenu,
  searchFilterToken, searchFilterValues, searchRowMatcher,
  type FilterMenu, type FilterOptions,
} from '../components/searchFilter.model';
import { ALICE, BOB, NAMES, group } from './searchFixtures';

const rows = [
  group('build', ['🚧 In progress'], [ALICE]),
  group('ship', ['🚧 In progress', 'Bug'], [BOB]),
  group('plan', ['Todo'], [ALICE, BOB]),
  group('loose', []),
  { ...group('left', ['Bug'], [ALICE]), inboxToAddr: { 'inbox-0': ALICE } },
];

const drafts: Record<string, string> = { plan: 'later' };

const matching = (query: string): string[] => (
  rows.filter(searchRowMatcher(parseSearchFilter(query), address => NAMES[address] ?? [], id => drafts[id] ?? ''))
    .map(row => row.convId)
);

const options: FilterOptions = {
  has: HAS_OPTIONS,
  label: ['Bug', 'Todo', '🚧 In progress'].map(label => ({ key: label, label, value: label })),
  member: [ME_OPTION, { key: ALICE, label: '@alice123', value: 'alice123' }, { key: BOB, label: '@chen123', value: 'chen123' }],
};

const menu = (query: string, caret = query.length): FilterMenu | null => searchFilterMenu(query, caret, options);

const shown = (query: string): string[] => {
  const found = menu(query);
  return found?.kind === 'values' ? found.options.map(option => option.value) : [];
};

function pick(query: string, value: string): ReturnType<typeof pickSearchFilter> {
  const found = menu(query);
  if (found?.kind !== 'values') throw new Error('values expected');
  return pickSearchFilter(query, found, (found.excludeRow ? 1 : 0) + found.options.findIndex(option => option.value === value));
}

describe('parsing exclude filters', () => {
  test('a minus before a field excludes its values, next to included ones and free text', () => {
    expect(parseSearchFilter('-label:Bug label:Todo -MEMBER:alice123,bob.base.eth ship')).toEqual({
      labels: ['Todo'], members: [], has: [], exclude: { labels: ['Bug'], members: ['alice123', 'bob.base.eth'], has: [] }, text: 'ship',
    });
  });

  test('empty excludes filter nothing and other words starting with a minus stay free text', () => {
    expect(parseSearchFilter('-label: -member:"" -foo')).toMatchObject({ exclude: { labels: [], members: [], has: [] }, text: '-foo' });
  });

  test('quoted excluded values round-trip and count as used values of the field', () => {
    const token = searchFilterToken('label', ['🚧 In progress', 'Todo'], true);
    expect(token).toBe('-label:"🚧 In progress",Todo');
    expect(parseSearchFilter(token).exclude.labels).toEqual(['🚧 In progress', 'Todo']);
    expect(searchFilterValues(`label:Bug ${token}`, 'label')).toEqual(['Bug', '🚧 In progress', 'Todo']);
  });
});

describe('matching exclude filters', () => {
  test('an excluded label hides the chats that have it, in any case', () => {
    expect(matching('-label:bug')).toEqual(['build', 'plan', 'loose']);
  });

  test('a comma group excludes chats with any of its values', () => {
    expect(matching('-label:Bug,Todo')).toEqual(['build', 'loose']);
    expect(matching('-label:Bug,Todo')).toEqual(matching('-label:Bug -label:Todo'));
    expect(matching('-member:alice123,bob.base.eth')).toEqual(['loose']);
  });

  test('an excluded member hides the chats they are in, by any of their names', () => {
    expect(matching('-member:bob.base.eth')).toEqual(['build', 'loose', 'left']);
    expect(matching('-member:"alice doe"')).toEqual(['ship', 'loose']);
    expect(matching('-member:@me')).toEqual(['left']);
  });

  test('include and exclude combine', () => {
    expect(matching('label:"🚧 In progress" -label:Bug')).toEqual(['build']);
    expect(matching('member:alice123 -member:bob.base.eth')).toEqual(['build', 'left']);
    expect(matching('label:"🚧 In progress",Todo -member:alice123 shi')).toEqual(['ship']);
    expect(matching('label:Bug -label:Bug')).toEqual([]);
  });

  test('has works the same way', () => {
    expect(matching('-has:label')).toEqual(['loose']);
    expect(matching('label:Todo,Bug -has:draft')).toEqual(['ship', 'left']);
  });
});

describe('exclude in the filter menu', () => {
  test('an empty label or member value offers the exclude row first', () => {
    expect(menu('label:')).toMatchObject({ kind: 'values', negated: false, excludeRow: true, options: options.label });
    expect(filterMenuSize(menu('label:'))).toBe(4);
    expect(menu('ship member:')).toMatchObject({ field: 'member', excludeRow: true });
  });

  test('no exclude row once a value is typed, after a comma, on has or on an excluded field', () => {
    for (const query of ['label:t', 'member:@', 'label:Bug,', 'has:', '-label:']) {
      expect(menu(query)).toMatchObject({ kind: 'values', excludeRow: false });
    }
  });

  test('the exclude row turns the field into an excluded one that lists the same values', () => {
    const values = menu('ship label:');
    if (values === null) throw new Error('menu expected');
    expect(pickSearchFilter('ship label:', values, 0)).toEqual({ query: 'ship -label:', caret: 12 });
    expect(menu('ship -label:')).toMatchObject({ kind: 'values', field: 'label', negated: true, options: options.label });
  });

  test('a minus lists the fields to exclude', () => {
    expect(menu('ship -')).toEqual({ kind: 'fields', word: { start: 5, end: 6 }, negated: true, fields: ['label', 'member'] });
    expect(menu('-M')).toMatchObject({ negated: true, fields: ['member'] });
    expect(menu('-h')).toBeNull();
    const fields = menu('-m');
    if (fields === null) throw new Error('menu expected');
    expect(pickSearchFilter('-m', fields, 0)).toEqual({ query: '-member:', caret: 8 });
  });

  test('values already included or excluded are not offered again', () => {
    expect(shown('label:Todo -label:')).toEqual(['Bug', '🚧 In progress']);
    expect(shown('-label:Bug label:')).toEqual(['Todo', '🚧 In progress']);
    expect(shown('-label:Bug,')).toEqual(['Todo', '🚧 In progress']);
    expect(shown('member:@me -member:')).toEqual(['alice123', 'chen123']);
    expect(shown('-member:@ALICE123 member:')).toEqual(['@me', 'chen123']);
    expect(menu('label:Bug,Todo -label:"🚧 In progress" label:')).toBeNull();
  });

  test('picking an excluded value completes or joins the excluded token, never the included one', () => {
    expect(pick('-label:', 'Todo')).toEqual({ query: '-label:Todo ', caret: 12 });
    expect(pick('-label:Bug ship -label:', 'Todo')).toEqual({ query: '-label:Bug,Todo ship ', caret: 21 });
    expect(pick('label:Bug -label:', 'Todo')).toEqual({ query: 'label:Bug -label:Todo ', caret: 22 });
    expect(pick('-member:@me ship member:', 'chen123')).toEqual({ query: '-member:@me ship member:chen123 ', caret: 32 });
    expect(pick('-member:@me,ch', 'chen123')).toEqual({ query: '-member:@me,chen123 ', caret: 20 });
  });
});
