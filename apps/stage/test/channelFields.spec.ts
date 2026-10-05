import { describe, expect, mock, test } from 'bun:test';
import {
  CHANNEL_FIELDS, DEFAULT_CHANNEL_FIELDS, parseChannelFields, toggleChannelFieldIn,
} from '../components/home/fields.model';

const values = new Map<string, string>();
let activeId = 'alice';
mock.module('../platform/storage', () => ({
  secureStorage: {},
  appStorage: {
    get: async (key: string): Promise<string | null> => values.get(key) ?? null,
    set: async (key: string, value: string): Promise<void> => { values.set(key, value); },
  },
}));
mock.module('../lib/accounts', () => ({ getActiveAccount: async () => ({ id: activeId }) }));
const { toggleChannelField } = await import('../lib/channelFields');
const settle = (): Promise<void> => new Promise(resolve => { setTimeout(resolve, 0); });
const stored = (account: string): unknown => JSON.parse(values.get(`home.fields.${account}`) ?? 'null');

const hidden = { members: false, assignees: false, category: false, status: false, labels: false, priority: false };

describe('channel field preferences', () => {
  test('lists all six fields in display order and preserves existing view defaults', () => {
    expect(CHANNEL_FIELDS.map(({ id, label }) => [id, label])).toEqual([
      ['members', 'Members'], ['assignees', 'Assignees'], ['category', 'Category'],
      ['status', 'Status'], ['labels', 'Labels'], ['priority', 'Priority'],
    ]);
    expect(DEFAULT_CHANNEL_FIELDS).toEqual({ chats: { ...hidden, labels: true }, board: hidden });
  });

  test('missing or invalid persisted data falls back without throwing', () => {
    for (const raw of ['', '{', 'null', 'false', '4', '"text"', '[]', '{}', '{"chats":null,"board":[]}']) {
      expect(parseChannelFields(raw)).toEqual(DEFAULT_CHANNEL_FIELDS);
    }
  });

  test('partial saved preferences gain missing fields and the missing view defaults', () => {
    expect(parseChannelFields('{"chats":{"labels":false,"members":true}}')).toEqual({
      chats: { ...hidden, members: true }, board: hidden,
    });
    expect(parseChannelFields('{"board":{"status":true}}')).toEqual({
      chats: DEFAULT_CHANNEL_FIELDS.chats, board: { ...hidden, status: true },
    });
  });

  test('invalid booleans fall back individually and unknown fields or views are ignored', () => {
    expect(parseChannelFields(JSON.stringify({
      chats: { members: true, assignees: 1, category: 'true', status: false, labels: null, priority: [] },
      board: { members: false, assignees: true, category: {}, status: 'false', labels: true, priority: null, extra: true },
      future: { members: true },
    }))).toEqual({
      chats: { ...hidden, members: true, labels: true },
      board: { ...hidden, assignees: true, labels: true },
    });
  });

  test('saved preferences round trip all fields in both views', () => {
    const prefs = {
      chats: { members: true, assignees: false, category: true, status: false, labels: false, priority: true },
      board: { members: false, assignees: true, category: false, status: true, labels: true, priority: false },
    };
    expect(parseChannelFields(JSON.stringify(prefs))).toEqual(prefs);
  });

  test('each toggle changes only its field and view without mutating the previous state', () => {
    for (const view of ['chats', 'board'] as const) {
      for (const { id } of CHANNEL_FIELDS) {
        const current = parseChannelFields('{}');
        const before = JSON.stringify(current);
        const next = toggleChannelFieldIn(current, view, id);
        expect(next).not.toBe(current);
        expect(next[view]).not.toBe(current[view]);
        expect(next[view]).toEqual({ ...current[view], [id]: !current[view][id] });
        const otherView = view === 'chats' ? 'board' : 'chats';
        expect(next[otherView]).toBe(current[otherView]);
        expect(JSON.stringify(current)).toBe(before);
        expect(toggleChannelFieldIn(next, view, id)).toEqual(current);
      }
    }
  });
});

describe('channel field storage', () => {
  test('hydrates, persists and restores view preferences separately for each account', async () => {
    values.set('home.fields.alice', '{"chats":{"members":true}}');
    toggleChannelField('chats', 'labels');
    toggleChannelField('board', 'priority');
    await settle();
    expect(stored('alice')).toEqual({ chats: { ...hidden, members: true }, board: { ...hidden, priority: true } });

    activeId = 'bob';
    toggleChannelField('board', 'labels');
    await settle();
    expect(stored('bob')).toEqual({ chats: DEFAULT_CHANNEL_FIELDS.chats, board: { ...hidden, labels: true } });
    expect(stored('alice')).toEqual({ chats: { ...hidden, members: true }, board: { ...hidden, priority: true } });

    activeId = 'alice';
    toggleChannelField('board', 'priority');
    await settle();
    expect(stored('alice')).toEqual({ chats: { ...hidden, members: true }, board: hidden });
    expect(stored('bob')).toEqual({ chats: DEFAULT_CHANNEL_FIELDS.chats, board: { ...hidden, labels: true } });
    expect([...values.keys()]).toEqual(['home.fields.alice', 'home.fields.bob']);
  });
});
