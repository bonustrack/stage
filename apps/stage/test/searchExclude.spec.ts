import { describe, expect, test } from 'bun:test';
import { parseSearchFilter, searchFilterToken, searchFilterValues, searchRowMatcher } from '../components/searchFilter.model';
import { ALICE, BOB, NAMES, group } from './searchFixtures';

const rows = [
  group('build', ['🚧 In progress'], [ALICE]),
  group('ship', ['🚧 In progress', 'Bug'], [BOB]),
  group('plan', ['Todo'], [ALICE, BOB]),
  group('loose', []),
  { ...group('left', ['Bug'], [ALICE]), inboxToAddr: { 'inbox-0': ALICE } },
];

const drafts: Record<string, string> = { plan: 'later' };

const matching = (query: string): string[] =>
  rows
    .filter(
      searchRowMatcher(
        parseSearchFilter(query),
        (address) => NAMES[address] ?? [],
        (id) => drafts[id] ?? '',
      ),
    )
    .map((row) => row.convId);

const NONE = { labels: [], members: [], categories: [], statuses: [], priorities: [], has: [] };

describe('parsing exclude filters', () => {
  test('a minus before a field excludes its values, next to included ones and free text', () => {
    expect(parseSearchFilter('-label:Bug label:Todo -MEMBER:alice123,bob.base.eth ship')).toEqual({
      ...NONE,
      labels: ['Todo'],
      exclude: { ...NONE, labels: ['Bug'], members: ['alice123', 'bob.base.eth'] },
      text: 'ship',
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
