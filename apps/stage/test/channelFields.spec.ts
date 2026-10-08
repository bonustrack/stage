import { beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import {
  CHANNEL_FIELDS, DEFAULT_CHANNEL_FIELDS, parseChannelFields, toggleChannelFieldIn, visibleChannelFieldCount,
} from '../components/home/fields.model';

const values = new Map<string, string>();
const writes: string[] = [];
let activeId = 'alice';
let failedKey: string | null = null;
let account = 0;
mock.module('../platform/storage', () => ({
  secureStorage: {},
  appStorage: {
    get: async (key: string): Promise<string | null> => {
      if (key === failedKey) throw new Error('storage unavailable');
      return values.get(key) ?? null;
    },
    set: async (key: string, value: string): Promise<void> => { writes.push(key); values.set(key, value); },
  },
}));
mock.module('../lib/accounts', () => ({
  getActiveAccount: async () => ({ id: activeId }),
  getActiveAccountStrict: async () => ({ id: activeId }),
}));
const { toggleChannelField } = await import('../lib/channelFields');
const settle = (): Promise<void> => new Promise(resolve => { setTimeout(resolve, 0); });
const stored = (id: string): unknown => JSON.parse(values.get(`home.fields.${id}`) ?? 'null');

const hidden = { members: false, assignees: false, category: false, status: false, labels: false, priority: false, avatar: false };

beforeEach(() => {
  values.clear();
  writes.length = 0;
  failedKey = null;
  activeId = `account-${++account}`;
});

describe('channel field preferences', () => {
  test('lists all seven fields in display order and preserves existing view defaults', () => {
    expect(CHANNEL_FIELDS.map(({ id, label }) => [id, label])).toEqual([
      ['members', 'Members'], ['assignees', 'Assignees'], ['category', 'Project'],
      ['status', 'Status'], ['labels', 'Labels'], ['priority', 'Priority'], ['avatar', 'Avatar'],
    ]);
    expect(DEFAULT_CHANNEL_FIELDS).toEqual({ chats: { ...hidden, labels: true, avatar: true }, board: hidden });
  });

  test('counts currently visible fields, including zero, independently for each view', () => {
    let prefs = parseChannelFields('{}');
    expect(visibleChannelFieldCount(prefs.chats)).toBe(2);
    expect(visibleChannelFieldCount(prefs.board)).toBe(0);
    for (const [index, { id }] of CHANNEL_FIELDS.entries()) {
      prefs = toggleChannelFieldIn(prefs, 'board', id);
      expect(visibleChannelFieldCount(prefs.board)).toBe(index + 1);
      expect(visibleChannelFieldCount(prefs.chats)).toBe(2);
    }
    for (const [index, { id }] of CHANNEL_FIELDS.entries()) {
      prefs = toggleChannelFieldIn(prefs, 'board', id);
      expect(visibleChannelFieldCount(prefs.board)).toBe(CHANNEL_FIELDS.length - index - 1);
    }
    const unknownField = { ...prefs.chats, future: true };
    expect(visibleChannelFieldCount(unknownField)).toBe(2);
    expect(visibleChannelFieldCount(parseChannelFields('{"chats":{"labels":false}}').chats)).toBe(1);
  });

  test('missing or invalid persisted data falls back without throwing', () => {
    for (const raw of ['', '{', 'null', 'false', '4', '"text"', '[]', '{}', '{"chats":null,"board":[]}']) {
      expect(parseChannelFields(raw)).toEqual(DEFAULT_CHANNEL_FIELDS);
      expect(parseChannelFields(raw, false)).toEqual({ chats: { ...hidden, labels: true }, board: hidden });
    }
  });

  test('partial saved preferences gain missing fields and the missing view defaults', () => {
    expect(parseChannelFields('{"chats":{"labels":false,"members":true}}')).toEqual({
      chats: { ...hidden, members: true, avatar: true }, board: hidden,
    });
    expect(parseChannelFields('{"board":{"status":true}}')).toEqual({
      chats: DEFAULT_CHANNEL_FIELDS.chats, board: { ...hidden, status: true },
    });
  });

  test('invalid booleans fall back individually and unknown fields or views are ignored', () => {
    expect(parseChannelFields(JSON.stringify({
      chats: { members: true, assignees: 1, category: 'true', status: false, labels: null, priority: [], avatar: null },
      board: { members: false, assignees: true, category: {}, status: 'false', labels: true, priority: null, avatar: 'true', extra: true },
      future: { members: true },
    }))).toEqual({
      chats: { ...hidden, members: true, labels: true, avatar: true },
      board: { ...hidden, assignees: true, labels: true },
    });
    expect(parseChannelFields('{"chats":{"avatar":"true"}}', false).chats.avatar).toBe(false);
  });

  test('saved preferences round trip all fields in both views', () => {
    const prefs = {
      chats: { members: true, assignees: false, category: true, status: false, labels: false, priority: true, avatar: false },
      board: { members: false, assignees: true, category: false, status: true, labels: true, priority: false, avatar: true },
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
    activeId = 'alice';
    values.set('home.fields.alice', '{"chats":{"members":true}}');
    toggleChannelField('chats', 'labels');
    toggleChannelField('board', 'priority');
    await settle();
    const aliceChats = { ...hidden, members: true, avatar: true };
    expect(stored('alice')).toEqual({ chats: aliceChats, board: { ...hidden, priority: true } });

    activeId = 'bob';
    toggleChannelField('board', 'avatar');
    await settle();
    expect(stored('bob')).toEqual({ chats: DEFAULT_CHANNEL_FIELDS.chats, board: { ...hidden, avatar: true } });
    expect(stored('alice')).toEqual({ chats: aliceChats, board: { ...hidden, priority: true } });

    activeId = 'alice';
    toggleChannelField('chats', 'avatar');
    await settle();
    expect(stored('alice')).toEqual({ chats: { ...aliceChats, avatar: false }, board: { ...hidden, priority: true } });
    expect(stored('bob')).toEqual({ chats: DEFAULT_CHANNEL_FIELDS.chats, board: { ...hidden, avatar: true } });
    expect([...values.keys()]).toEqual(['home.fields.alice', 'home.fields.bob']);
  });

  test('migrates missing storage and six-field preferences from legacy avatars without writing the global key', async () => {
    const sixFields = {
      chats: { members: true, assignees: false, category: true, status: false, labels: false, priority: true },
      board: { members: false, assignees: true, category: false, status: true, labels: true, priority: false },
    };
    for (const avatars of [null, '0', '1']) {
      if (avatars === null) values.delete('channels.avatars');
      else values.set('channels.avatars', avatars);
      for (const prior of [undefined, sixFields]) {
        activeId = `migration-${avatars}-${prior ? 'six' : 'empty'}`;
        if (prior) values.set(`home.fields.${activeId}`, JSON.stringify(prior));
        toggleChannelField('board', 'avatar');
        await settle();
        expect(stored(activeId)).toEqual({
          chats: { ...DEFAULT_CHANNEL_FIELDS.chats, ...prior?.chats, avatar: avatars !== '0' },
          board: { ...hidden, ...prior?.board, avatar: true },
        });
        expect(values.get('channels.avatars')).toBe(avatars ?? undefined);
      }
    }
    expect(writes.every(key => key.startsWith('home.fields.'))).toBe(true);
  });

  test('explicit avatar choices win over legacy values in either direction', async () => {
    for (const avatar of [false, true]) {
      activeId = `explicit-${avatar}`;
      values.set('channels.avatars', avatar ? '0' : '1');
      values.set(`home.fields.${activeId}`, JSON.stringify({ chats: { avatar }, board: { avatar: !avatar } }));
      toggleChannelField('chats', 'status');
      await settle();
      expect(stored(activeId)).toEqual({
        chats: { ...DEFAULT_CHANNEL_FIELDS.chats, status: true, avatar }, board: { ...hidden, avatar: !avatar },
      });
    }
    expect(writes).toEqual(['home.fields.explicit-false', 'home.fields.explicit-true']);
  });

  test('failed preference or legacy reads never overwrite saved state and can be retried', async () => {
    const warnings = spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      toggleChannelField('chats', 'labels');
      await settle();
      values.set('channels.avatars', '0');
      for (const source of ['fields', 'legacy']) {
        activeId = `failed-${source}`;
        const key = `home.fields.${activeId}`;
        values.set(key, '{"chats":{"priority":true},"board":{"members":true}}');
        const before = [...values];
        writes.length = 0;
        failedKey = source === 'fields' ? key : 'channels.avatars';
        toggleChannelField('chats', 'avatar');
        await settle();
        expect([...values]).toEqual(before);
        expect(writes).toEqual([]);
        failedKey = null;
        toggleChannelField('chats', 'avatar');
        await settle();
        expect(stored(activeId)).toEqual({
          chats: { ...DEFAULT_CHANNEL_FIELDS.chats, priority: true }, board: { ...hidden, members: true },
        });
        expect(writes).toEqual([key]);
      }
      expect(warnings).toHaveBeenCalledWith('[stage:channelFields.save] storage unavailable');
    } finally { warnings.mockRestore(); }
  });
});
