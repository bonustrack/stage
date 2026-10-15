import { beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import {
  DEFAULT_LAST_ACTIVITY, LAST_ACTIVITY_WINDOWS, lastActivityCutoff, matchesLastActivity, parseLastActivity,
} from '../components/home/activity.model';
import { boardColumns, searchedColumns } from '../components/board/BoardScreen.model';
import { deriveSortedRows } from '../components/home/model';
import { parseSearchFilter, searchRowMatcher } from '../components/searchFilter.model';
import { group } from './searchFixtures';
import { bumpAccountEpoch } from '../lib/accountEpoch';

const DAY = 86_400_000;
const now = 40 * DAY;
const values = new Map<string, string>();
const writes: string[] = [];
let activeId = 'activity-alice';
let failedKey: string | null = null;
let blockedRead: { key: string; pending: Promise<void> } | null = null;
let account = 0;
mock.module('../platform/storage', () => ({
  secureStorage: {},
  appStorage: {
    get: async (key: string): Promise<string | null> => {
      if (key === failedKey) throw new Error('storage unavailable');
      const saved = values.get(key) ?? null;
      if (blockedRead?.key === key) await blockedRead.pending;
      return saved;
    },
    set: async (key: string, value: string): Promise<void> => { writes.push(key); values.set(key, value); },
  },
}));
mock.module('../lib/accounts', () => ({
  getActiveAccount: async () => ({ id: activeId }),
  getActiveAccountStrict: async () => ({ id: activeId }),
}));
mock.module('../lib/appInFront', () => ({ isAppInFront: () => true, subscribeAppInFront: () => () => undefined }));
const { getLastActivity, setLastActivity } = await import('../lib/lastActivity');
const settle = (): Promise<void> => new Promise(resolve => { setTimeout(resolve, 0); });
const stored = (id: string): unknown => JSON.parse(values.get(`home.activity.${id}`) ?? 'null');

beforeEach(() => {
  values.clear();
  writes.length = 0;
  failedKey = null;
  blockedRead = null;
  activeId = `activity-${++account}`;
});

describe('Last activity windows', () => {
  test('All preserves existing behavior and stored choices are independent by view', () => {
    expect(LAST_ACTIVITY_WINDOWS).toEqual(['1d', '3d', '7d', '30d', 'all']);
    expect(lastActivityCutoff('all', now)).toBeNull();
    expect(matchesLastActivity({}, null)).toBe(true);
    for (const raw of ['', '{', 'null', '[]', 'false', '{}', '{"chats":"2d","board":5}']) {
      expect(parseLastActivity(raw)).toEqual(DEFAULT_LAST_ACTIVITY);
    }
    expect(parseLastActivity('{"chats":"3d"}')).toEqual({ chats: '3d', board: 'all' });
    expect(parseLastActivity('{"chats":null,"board":"7d"}')).toEqual({ chats: 'all', board: '7d' });
  });

  test('every finite window includes the exact cutoff and excludes activity one millisecond older', () => {
    for (const window of LAST_ACTIVITY_WINDOWS) {
      if (window === 'all') continue;
      const cutoff = lastActivityCutoff(window, now);
      expect(cutoff).toBe(now - Number.parseInt(window, 10) * DAY);
      if (cutoff === null) throw new Error('finite window expected');
      expect(matchesLastActivity({ lastTs: cutoff }, cutoff)).toBe(true);
      expect(matchesLastActivity({ lastTs: cutoff - 1 }, cutoff)).toBe(false);
      expect(matchesLastActivity({ lastTs: now }, cutoff)).toBe(true);
    }
  });

  test('uses the same valid activity timestamp and creation fallback as Updated sorting', () => {
    const cutoff = lastActivityCutoff('1d', now);
    for (const lastTs of [undefined, null, 0, -1, NaN, Infinity]) {
      expect(matchesLastActivity({ lastTs }, cutoff)).toBe(false);
      expect(matchesLastActivity({ lastTs, createdTs: now }, cutoff)).toBe(true);
    }
    expect(matchesLastActivity({ lastTs: now - 2 * DAY, createdTs: now }, cutoff)).toBe(false);
    expect(matchesLastActivity({ lastTs: now, createdTs: now - 2 * DAY }, cutoff)).toBe(true);
    expect(matchesLastActivity({ lastTs: NaN, createdTs: Infinity }, cutoff)).toBe(false);
  });

  test('rolling windows age idle rows out without changing the selected duration', () => {
    const row = { lastTs: now - DAY + 1 };
    expect(matchesLastActivity(row, lastActivityCutoff('1d', now))).toBe(true);
    expect(matchesLastActivity(row, lastActivityCutoff('1d', now + 2))).toBe(false);
  });

  test('ANDs with search and chips, excludes old pins, and preserves empty Board columns', () => {
    const rows = [
      { ...group('recent', ['Bug']), lastTs: now, category: 'Stage', status: 'Todo' },
      { ...group('old', ['Bug']), lastTs: now - 4 * DAY, category: 'Stage', status: 'Done' },
      { ...group('other', ['Feature']), lastTs: now, category: 'Snapshot', status: 'Todo' },
    ];
    const cutoff = lastActivityCutoff('3d', now);
    const matches = searchRowMatcher(parseSearchFilter('category:Stage -status:Done rec'), () => [], () => '', cutoff);
    const listed = deriveSortedRows({ rows, enabledLabels: new Set(['bug']), unreadOnly: false, pinned: ['old'] });
    expect(listed.filter(matches).map(row => row.convId)).toEqual(['recent']);
    const columns = boardColumns(rows, ['old'], ['status:Todo', 'status:Done', 'status:Blocked'], 'status');
    const shown = searchedColumns(columns, 'category:Stage', () => [], () => '', cutoff);
    expect(shown.map(column => column.key)).toEqual(columns.map(column => column.key));
    expect(shown.find(column => column.key === 'status:Done')?.rows).toEqual([]);
    expect(shown.find(column => column.key === 'status:Blocked')?.rows).toEqual([]);
    expect(shown.flatMap(column => column.rows).map(row => row.convId)).toEqual(['recent']);
    expect(searchedColumns(columns, '', () => [], () => '', null).flatMap(column => column.rows)).toHaveLength(3);
  });
});

describe('Last activity local preferences', () => {
  test('hydrates and persists separate selections for each view and account', async () => {
    activeId = 'activity-alice';
    values.set('home.activity.activity-alice', '{"chats":"3d","board":"7d"}');
    setLastActivity('chats', '1d');
    setLastActivity('board', '30d');
    await settle();
    expect(stored(activeId)).toEqual({ chats: '1d', board: '30d' });
    activeId = 'activity-bob';
    setLastActivity('board', '3d');
    await settle();
    expect(stored(activeId)).toEqual({ chats: 'all', board: '3d' });
    activeId = 'activity-alice';
    setLastActivity('chats', 'all');
    await settle();
    expect(stored(activeId)).toEqual({ chats: 'all', board: '30d' });
    expect(stored('activity-bob')).toEqual({ chats: 'all', board: '3d' });
    expect(writes.every(key => key.startsWith('home.activity.'))).toBe(true);
  });

  test('an edit waiting on hydration never writes to a different account', async () => {
    activeId = 'activity-race-alice';
    const aliceKey = `home.activity.${activeId}`;
    values.set(aliceKey, '{"chats":"3d","board":"7d"}');
    let release = (): void => undefined;
    blockedRead = { key: aliceKey, pending: new Promise<void>(resolve => { release = resolve; }) };
    setLastActivity('chats', '1d');
    await settle();
    activeId = 'activity-race-bob';
    values.set(`home.activity.${activeId}`, '{"chats":"30d","board":"all"}');
    bumpAccountEpoch();
    release();
    await settle();
    expect(writes).toEqual([]);
    expect(stored('activity-race-alice')).toEqual({ chats: '3d', board: '7d' });
    expect(stored(activeId)).toEqual({ chats: '30d', board: 'all' });
    expect(getLastActivity('chats')).toBe('30d');
  });

  test('a failed account-switch read never exposes the previous account selection', async () => {
    const warnings = spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      activeId = 'activity-failure-alice';
      setLastActivity('chats', '1d');
      await settle();
      expect(getLastActivity('chats')).toBe('1d');
      activeId = 'activity-failure-bob';
      failedKey = `home.activity.${activeId}`;
      values.set(failedKey, '{"chats":"all","board":"7d"}');
      bumpAccountEpoch();
      expect(getLastActivity('chats')).toBe('all');
      await settle();
      expect(getLastActivity('chats')).toBe('all');
      expect(getLastActivity('board')).toBe('all');
      expect(stored(activeId)).toEqual({ chats: 'all', board: '7d' });
      failedKey = null;
      setLastActivity('chats', '3d');
      await settle();
      expect(getLastActivity('chats')).toBe('3d');
      expect(getLastActivity('board')).toBe('7d');
    } finally { warnings.mockRestore(); }
  });

  test('a failed read never overwrites saved choices and can be retried', async () => {
    const warnings = spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const key = `home.activity.${activeId}`;
      values.set(key, '{"chats":"3d","board":"7d"}');
      failedKey = key;
      setLastActivity('chats', '1d');
      await settle();
      expect(writes).toEqual([]);
      expect(stored(activeId)).toEqual({ chats: '3d', board: '7d' });
      failedKey = null;
      setLastActivity('chats', '1d');
      await settle();
      expect(stored(activeId)).toEqual({ chats: '1d', board: '7d' });
      expect(warnings).toHaveBeenCalledWith('[stage:lastActivity.save] storage unavailable');
    } finally { warnings.mockRestore(); }
  });
});
