import { describe, expect, test } from 'bun:test';
import { filterChannelRows } from '@stage-labs/client/xmtp/channelsFilter';
import {
  parseSearchFilter, searchFilterSources, searchFilterToken, searchRowMatcher, type FilterRow,
} from '../components/searchFilter.model';
import { boardColumns, searchedColumns } from '../components/board/BoardScreen.model';
import { ALICE, BOB, NAMES, SELF, group } from './searchFixtures';

const namesOf = (address: string): string[] => NAMES[address] ?? [];

const NONE = { labels: [], members: [], categories: [], statuses: [], priorities: [], has: [] };

const rows = [
  group('build', ['🚧 In progress'], [ALICE]),
  group('ship', ['🚧 In progress', 'Bug'], [BOB]),
  group('plan', ['Todo'], [ALICE, BOB]),
];

const matching = (query: string): string[] => {
  const matches = searchRowMatcher(parseSearchFilter(query), namesOf);
  return rows.filter(matches).map(row => row.convId);
};

describe('parsing the search filter', () => {
  test('splits label and member tokens from the free text', () => {
    expect(parseSearchFilter('label:"🚧 In progress" member:alice123 ship it')).toEqual({
      ...NONE, labels: ['🚧 In progress'], members: ['alice123'], exclude: NONE, text: 'ship it',
    });
  });

  test('field names ignore case, empty values filter nothing and extra spaces go away', () => {
    expect(parseSearchFilter('  LABEL:Todo   Member:  label:""  ')).toEqual({
      ...NONE, labels: ['Todo'], exclude: NONE, text: '',
    });
  });

  test('an unfinished quote keeps the rest of the words in the value', () => {
    expect(parseSearchFilter('label:"🚧 In').labels).toEqual(['🚧 In']);
  });

  test('member:@me is a member token like any other', () => {
    expect(parseSearchFilter('member:@me ship member:alice123')).toEqual({
      ...NONE, members: ['@me', 'alice123'], exclude: NONE, text: 'ship',
    });
  });
});

describe('matching board cards', () => {
  test('values of one field are OR, different fields are AND', () => {
    expect(matching('label:Todo label:Bug')).toEqual(['ship', 'plan']);
    expect(matching('label:"🚧 in progress" member:bob.base.eth')).toEqual(['ship']);
  });

  test('a member matches by username, @username, full name, display name or address start', () => {
    expect(matching('member:alice123')).toEqual(['build', 'plan']);
    expect(matching('member:@alice123')).toEqual(['build', 'plan']);
    expect(matching('member:alice123.stage.base.eth')).toEqual(['build', 'plan']);
    expect(matching('member:"alice doe"')).toEqual(['build', 'plan']);
    expect(matching('member:0xB0B0')).toEqual(['ship', 'plan']);
  });

  test('you are not a member you can filter on by name or address', () => {
    expect(matching(`member:${SELF}`)).toEqual([]);
  });

  test('free text still matches titles next to the tokens', () => {
    expect(matching('label:"🚧 In progress" shi')).toEqual(['ship']);
    expect(matching('nothing')).toEqual([]);
  });

  test('searched columns keep every column and filter their cards', () => {
    const shown = searchedColumns(boardColumns(rows, [], [], 'label'), 'member:bob.base.eth', namesOf);
    expect(shown.map(c => [c.label, c.rows.map(r => r.convId)])).toEqual([
      ['🚧 In progress', ['ship']], ['Bug', ['ship']], ['Todo', ['plan']],
    ]);
  });
});

describe('member:@me', () => {
  const left: FilterRow = { ...group('left', ['Todo'], [ALICE]), inboxToAddr: { 'inbox-0': ALICE } };
  const unknown: FilterRow = { ...group('unknown', ['Todo'], [BOB]), selfInboxId: undefined };
  const all = [...rows, left, unknown];
  const found = (query: string): string[] => all.filter(searchRowMatcher(parseSearchFilter(query), namesOf)).map(row => row.convId);

  test('matches the channels you are a member of, whatever the case', () => {
    expect(found('member:@me')).toEqual(['build', 'ship', 'plan']);
    expect(found('member:@ME')).toEqual(['build', 'ship', 'plan']);
  });

  test('works with other tokens and free text', () => {
    expect(found('member:@me label:Todo')).toEqual(['plan']);
    expect(found('member:@me member:alice123')).toEqual(['build', 'ship', 'plan', 'left']);
    expect(found('member:@me shi')).toEqual(['ship']);
  });

  test('needs the @, a plain me is a name', () => {
    expect(found('member:me')).toEqual([]);
  });

  test('groups with other members after a comma', () => {
    expect(found('member:@me,alice123')).toEqual(found('member:@me member:alice123'));
  });
});

describe('filter values on the board', () => {
  test('labels and members come from all channels but not direct chats or you', () => {
    const dm = { ...group('dm', ['Private'], ['0xprivate']), peerAddress: BOB };
    const unlabelled = group('loose', [], ['0xc0ffee']);
    expect(searchFilterSources([...rows, dm, unlabelled, group('dup', ['todo'])], 'board')).toEqual({
      labels: ['🚧 In progress', 'Bug', 'Todo'], members: [ALICE, BOB, '0xc0ffee'], categories: [], statuses: [],
    });
  });
});

describe('the search filter on the chats page', () => {
  const dm: FilterRow = { ...group('bob dm', [], [BOB]), peerAddress: BOB, lastPreview: 'see you at lunch' };
  const chats = [...rows, dm];
  const found = (query: string): string[] => (
    chats.filter(searchRowMatcher(parseSearchFilter(query), namesOf)).map(row => row.convId)
  );

  test('every chat gives values, direct chats and unlabelled groups included, without you', () => {
    const loose = group('loose', [], ['0xc0ffee']);
    expect(searchFilterSources([...chats, loose], 'chats')).toEqual({
      labels: ['🚧 In progress', 'Bug', 'Todo'], members: [ALICE, BOB, '0xc0ffee'], categories: [], statuses: [],
    });
  });

  test('a member filter finds the direct chat with that member', () => {
    expect(found('member:bob.base.eth')).toEqual(['ship', 'plan', 'bob dm']);
    expect(found('member:bob.base.eth lunch')).toEqual(['bob dm']);
  });

  test('free text alone matches like the chats search did', () => {
    for (const query of ['lunch', 'PLAN', ' ship ', 'bob dm', BOB.slice(0, 8), 'nothing']) {
      expect(found(query)).toEqual(filterChannelRows(chats, { query }).map(row => row.convId));
    }
  });
});

describe('values grouped per field', () => {
  test('a comma joins values of one field, in any order next to the old repeated form', () => {
    expect(parseSearchFilter('member:@me,chen123 ship label:Todo,Bug')).toEqual({
      ...NONE, labels: ['Todo', 'Bug'], members: ['@me', 'chen123'], exclude: NONE, text: 'ship',
    });
    expect(parseSearchFilter('member:@me member:chen123,,')).toEqual(parseSearchFilter('member:@me,chen123'));
  });

  test('comma and repeated forms match the same cards', () => {
    expect(matching('label:Todo,Bug')).toEqual(matching('label:Todo label:Bug'));
    expect(matching('member:alice123,bob.base.eth label:Todo')).toEqual(['plan']);
  });

  test('quoted labels with emoji, spaces or commas round-trip', () => {
    const labels = ['🚧 In progress', '🔍 In review', 'a,b', 'Todo'];
    const token = searchFilterToken('label', labels);
    expect(token).toBe('label:"🚧 In progress","🔍 In review","a,b",Todo');
    expect(parseSearchFilter(`${token} ship`)).toEqual({ ...NONE, labels, exclude: NONE, text: 'ship' });
    expect(searchFilterToken('member', ['@me', 'chen123'])).toBe('member:@me,chen123');
  });
});
