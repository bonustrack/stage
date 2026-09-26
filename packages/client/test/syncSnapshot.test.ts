import { describe, expect, test } from 'bun:test';
import { needsReadMark, type CachedChannelRow } from '../src/xmtp/channelsCache';
import {
  NO_SYNC_STAMPS, SNAPSHOT_EVERY, SNAPSHOT_OVERLAP_NS, SYNC_PAGE_SIZE, SYNC_SCAN_CAP, assembleSyncSnapshot, bootChangeCounter,
  changesSince, collectSnapshotReplay, countSyncChange, isSyncSnapshotType, isSyncStateType, mergeSyncStamps, parseChangeCounter,
  parseReadStateFile, parseSyncSnapshot, parseSyncStamps, replayStamps, scanCovers, scanSyncGroups, scanSyncHistory, snapshotDue,
  type SnapshotInputs, type SyncPageMessage, type SyncSnapshotContent,
} from '../src/xmtp/syncSnapshot';

const READ = 'stage.box/readState:1.0';
const PIN = 'stage.box/pinState:1.0';
const SNAP = 'stage.box/syncSnapshot:1.0';
const BOARD = 'stage.box/boardState:1.0';
const CLEAR = 'stage.box/clearState:1.0';
const TEXT = 'xmtp.org/text:1.0';

function snapshot(over: Partial<SyncSnapshotContent> = {}): SyncSnapshotContent {
  return { reads: {}, pins: null, cleared: {}, board: null, groups: ['own'], at: 1, ...over };
}

function msg(sentNs: number, contentTypeId: string, content: unknown = {}): SyncPageMessage {
  return { id: `m${String(sentNs)}`, sentNs, contentTypeId, content };
}

function read(convId: string, at: number, lastReadNs = at): { convId: string; lastReadNs: number; markedUnread: boolean; at: number } {
  return { convId, lastReadNs, markedUnread: false, at };
}

function pager(all: readonly SyncPageMessage[]) {
  const sorted = [...all].sort((a, b) => b.sentNs - a.sentNs);
  const calls: (number | undefined)[] = [];
  const fetch = (limit: number, beforeMs: number | undefined): Promise<SyncPageMessage[]> => {
    if (calls.length >= 100) return Promise.reject(new Error('the scan never stopped'));
    calls.push(beforeMs);
    const page = sorted.filter((m) => beforeMs === undefined || m.sentNs < beforeMs * 1_000_000);
    return Promise.resolve(page.slice(0, limit));
  };
  return { fetch, calls };
}

function seconds(from: number, to: number, type = READ): SyncPageMessage[] {
  return Array.from({ length: to - from + 1 }, (_, i) => msg((from + i) * 1_000_000_000, type));
}

describe('sync snapshot payload', () => {
  test('parses a valid snapshot and rejects malformed ones', () => {
    const ok = snapshot({ reads: { c1: { lastReadNs: 5, markedUnread: false, at: 2 } } });
    expect(parseSyncSnapshot(ok)).toEqual(ok);
    expect(parseSyncSnapshot({ ...ok, reads: { '': { lastReadNs: 5, markedUnread: false, at: 2 } } })).toBeNull();
    expect(parseSyncSnapshot({ ...ok, at: 0 })).toBeNull();
    expect(parseSyncSnapshot({ ...ok, board: { order: ['a'] } })).toBeNull();
    expect(parseSyncSnapshot({ ...ok, groups: [''] })).toBeNull();
    expect(parseSyncSnapshot({ reads: {}, pins: null, cleared: {}, board: null, at: 1 })).toBeNull();
    expect(parseSyncSnapshot('nope')).toBeNull();
  });

  test('recognises its type and counts it as sync state', () => {
    expect(isSyncSnapshotType(SNAP)).toBe(true);
    expect(isSyncSnapshotType(READ)).toBe(false);
    expect(isSyncSnapshotType(undefined)).toBe(false);
    for (const type of [SNAP, READ, PIN, BOARD, CLEAR]) expect(isSyncStateType(type)).toBe(true);
    expect(isSyncStateType(TEXT)).toBe(false);
  });

  test('parses the local read file and rejects anything else', () => {
    const ok = { legacy: false, reads: { c1: { lastReadNs: 1, markedUnread: true, at: 3 } } };
    expect(parseReadStateFile(JSON.stringify(ok))).toEqual(ok);
    expect(parseReadStateFile(JSON.stringify({ reads: {} }))).toBeNull();
    expect(parseReadStateFile('{')).toBeNull();
  });
});

describe('collectSnapshotReplay', () => {
  test('expands a snapshot into reads, pins, deleted chats and board order', () => {
    const snap = snapshot({
      reads: { a: { lastReadNs: 7, markedUnread: true, at: 4 } },
      pins: { convId: 'p', pinned: true, order: ['p', 'q'], at: 5 },
      cleared: { '0xpeer': 9 },
      board: { order: ['x'], at: 6 },
    });
    const replay = collectSnapshotReplay([msg(100, SNAP, snap)], 0);
    expect(replay.reads).toEqual([{ convId: 'a', lastReadNs: 7, markedUnread: true, at: 4 }]);
    expect(replay.pins).toEqual([{ convId: 'p', pinned: true, order: ['p', 'q'], at: 5 }]);
    expect(replay.cleared).toEqual({ '0xpeer': 9 });
    expect(replay.board).toEqual({ order: ['x'], at: 6 });
    expect(replay.latestNs).toBe(100);
  });

  test('a change stamped later than the snapshot entry wins, an older one loses', () => {
    const snap = snapshot({ reads: { a: { lastReadNs: 40, markedUnread: false, at: 40 }, b: { lastReadNs: 40, markedUnread: false, at: 40 } } });
    const replay = collectSnapshotReplay([msg(50, READ, read('a', 60)), msg(100, SNAP, snap), msg(150, READ, read('b', 30))], 0);
    const byConv = Object.fromEntries(replay.reads.map((r) => [r.convId, r.at]));
    expect(byConv).toEqual({ a: 60, b: 40 });
  });

  test('an empty pin order in a snapshot unpins everything', () => {
    const snap = snapshot({ pins: { convId: 'p', pinned: false, order: [], at: 8 } });
    const replay = collectSnapshotReplay([msg(10, PIN, { convId: 'p', pinned: true, order: ['p'], at: 2 }), msg(20, SNAP, snap)], 0);
    expect(replay.pins).toEqual([{ convId: 'p', pinned: false, order: [], at: 8 }]);
  });

  test('a malformed snapshot contributes nothing', () => {
    const replay = collectSnapshotReplay([msg(10, SNAP, { reads: 'x' })], 0);
    expect(replay.reads).toEqual([]);
    expect(replay.cleared).toBeNull();
  });
});

describe('scanSyncHistory', () => {
  test('reads a short history in one page', async () => {
    const { fetch, calls } = pager(seconds(1, 50));
    const scan = await scanSyncHistory(fetch, 0, 'own');
    expect(scan.messages).toHaveLength(50);
    expect(scan.snapshotNs).toBeNull();
    expect(calls).toHaveLength(1);
  });

  test('stops paging at the newest snapshot, keeping one minute of overlap', async () => {
    const all = seconds(1, 1000).map((m) => (m.sentNs === 700_000_000_000 ? msg(m.sentNs, SNAP, snapshot()) : m));
    const { fetch, calls } = pager(all);
    const scan = await scanSyncHistory(fetch, 0, 'own');
    expect(scan.snapshotNs).toBe(700_000_000_000);
    expect(calls).toHaveLength(2);
    const oldest = Math.min(...scan.messages.map((m) => m.sentNs));
    expect(oldest).toBe(700_000_000_000 - SNAPSHOT_OVERLAP_NS + 1_000_000_000);
    expect(scan.messages).toHaveLength(360);
  });

  test('keeps paging past a snapshot that does not list this group', async () => {
    const all = seconds(1, 500).map((m) => (m.sentNs === 400_000_000_000 ? msg(m.sentNs, SNAP, snapshot({ groups: ['other'] })) : m));
    const scan = await scanSyncHistory(pager(all).fetch, 0, 'own');
    expect(scan.snapshotNs).toBeNull();
    expect(scan.messages).toHaveLength(500);
    expect(scan.covers.get('other')).toBe(400_000_000_000);
  });

  test('ignores a malformed snapshot and keeps paging', async () => {
    const all = seconds(1, 500).map((m) => (m.sentNs === 400_000_000_000 ? msg(m.sentNs, SNAP, { bad: true }) : m));
    const scan = await scanSyncHistory(pager(all).fetch, 0, 'own');
    expect(scan.snapshotNs).toBeNull();
    expect(scan.messages).toHaveLength(500);
  });

  test('stops at the cursor and returns only newer messages', async () => {
    const { fetch, calls } = pager(seconds(1, 1000));
    const scan = await scanSyncHistory(fetch, 900_000_000_000, 'own');
    expect(scan.messages).toHaveLength(100);
    expect(scan.messages.every((m) => m.sentNs > 900_000_000_000)).toBe(true);
    expect(calls).toHaveLength(1);
  });

  test('does not duplicate or lose messages sharing a millisecond across a page edge', async () => {
    const all = Array.from({ length: 300 }, (_, i) => msg(5_000_000_000 + i, READ));
    const scan = await scanSyncHistory(pager(all).fetch, 0, 'own');
    expect(scan.messages).toHaveLength(300);
    expect(new Set(scan.messages.map((m) => m.id)).size).toBe(300);
  });

  test('stops at the scan cap on a long history without a snapshot', async () => {
    const scan = await scanSyncHistory(pager(seconds(1, SYNC_SCAN_CAP + 1000)).fetch, 0, 'own');
    expect(scan.messages.length).toBeGreaterThanOrEqual(SYNC_SCAN_CAP);
    expect(scan.messages.length).toBeLessThan(SYNC_SCAN_CAP + SYNC_PAGE_SIZE);
  });

  test('a snapshot read only past the floor sets no floor for the groups it lists', async () => {
    const all = seconds(1, 1000).map((m) => {
      if (m.sentNs === 700_000_000_000) return msg(m.sentNs, SNAP, snapshot());
      return m.sentNs === 620_000_000_000 ? msg(m.sentNs, SNAP, snapshot({ groups: ['own', 'old'] })) : m;
    });
    const scan = await scanSyncHistory(pager(all).fetch, 0, 'own');
    expect(scan.snapshotNs).toBe(700_000_000_000);
    expect([...scan.covers]).toEqual([['own', 700_000_000_000]]);
  });
});

describe('scanCovers', () => {
  test('a history read to its start or to its floor is covered', async () => {
    expect(scanCovers(await scanSyncHistory(pager(seconds(1, 50)).fetch, 0, 'own'), 0)).toBe(true);
    expect(scanCovers(await scanSyncHistory(pager(seconds(1, 1000)).fetch, 900_000_000_000, 'own'), 0)).toBe(true);
  });

  test('a history cut at the scan cap is covered only down to a cursor already applied', async () => {
    const scan = await scanSyncHistory(pager(seconds(1, SYNC_SCAN_CAP + 1000)).fetch, 0, 'own');
    expect(scan.reachedNs).toBeGreaterThan(1_000_000_000);
    expect(scanCovers(scan, 0)).toBe(false);
    expect(scanCovers(scan, scan.reachedNs - 1)).toBe(false);
    expect(scanCovers(scan, scan.reachedNs)).toBe(true);
  });
});

describe('scanSyncGroups', () => {
  const withSnapshotAt = (atSeconds: number, groups: string[]) => (m: SyncPageMessage): SyncPageMessage =>
    (m.sentNs === atSeconds * 1_000_000_000 ? msg(m.sentNs, SNAP, snapshot({ groups })) : m);

  test('reads the publish group first and stops a group its snapshot lists at that snapshot', async () => {
    const own = pager(seconds(1, 1000).map(withSnapshotAt(700, ['own', 'old'])));
    const old = pager(seconds(1, 900));
    const groups = [{ id: 'old', fetch: old.fetch }, { id: 'own', fetch: own.fetch }];
    const floors: number[] = [];
    const scans = await scanSyncGroups(groups, 'own', async (group, floorNs) => {
      floors.push(floorNs);
      return { id: group.id, ...(await scanSyncHistory(group.fetch, floorNs, group.id)) };
    });
    const floor = 700_000_000_000 - SNAPSHOT_OVERLAP_NS;
    expect(scans.map((s) => s.id)).toEqual(['own', 'old']);
    expect(floors).toEqual([0, floor]);
    expect(scans[1]?.messages).toHaveLength(260);
    expect(scans[1]?.messages.every((m) => m.sentNs > floor)).toBe(true);
    expect(old.calls).toHaveLength(2);
  });

  test('reads in full a group the snapshot does not list', async () => {
    const own = pager(seconds(1, 1000).map(withSnapshotAt(700, ['own'])));
    const old = pager(seconds(1, 900));
    const groups = [{ id: 'old', fetch: old.fetch }, { id: 'own', fetch: own.fetch }];
    const scans = await scanSyncGroups(groups, 'own', (group, floorNs) => scanSyncHistory(group.fetch, floorNs, group.id));
    expect(scans[1]?.messages).toHaveLength(900);
  });

  test('reads the other groups by id, so a snapshot in one bounds the groups it lists read after it', async () => {
    const reads: [string, number][] = [];
    const listed = new Map([['a', 500_000_000_000]]);
    await scanSyncGroups([{ id: 'c' }, { id: 'b' }, { id: 'own' }, { id: 'a' }], 'own', (group, floorNs) => {
      reads.push([group.id, floorNs]);
      return Promise.resolve({ covers: group.id === 'a' ? new Map([...listed, ['c', 400_000_000_000]]) : new Map<string, number>() });
    });
    expect(reads).toEqual([['own', 0], ['a', 0], ['b', 0], ['c', 400_000_000_000 - SNAPSHOT_OVERLAP_NS]]);
  });
});

describe('change counter', () => {
  const deltas = (...ns: number[]) => ns.map((n) => msg(n, READ));

  test('counts state changes only, never snapshots or other messages', () => {
    expect(changesSince([...deltas(10, 20, 30), msg(25, SNAP, snapshot()), msg(26, TEXT)], 15)).toBe(2);
    expect(snapshotDue(SNAPSHOT_EVERY - 1)).toBe(false);
    expect(snapshotDue(SNAPSHOT_EVERY)).toBe(true);
  });

  test('a snapshot newer than the cursor restarts the count from it', () => {
    const scan = { messages: [...deltas(10, 20, 30), msg(15, SNAP, snapshot())], snapshotNs: 15, cursor: 0 };
    expect(bootChangeCounter(scan, { count: 150, ns: 5 })).toEqual({ count: 2, ns: 30 });
  });

  test('a fresh device counts what it read', () => {
    expect(bootChangeCounter({ messages: deltas(10, 20, 30), snapshotNs: null, cursor: 0 }, null)).toEqual({ count: 3, ns: 30 });
  });

  test('a device that synced before snapshots existed is due at once', () => {
    const counter = bootChangeCounter({ messages: deltas(10, 20), snapshotNs: null, cursor: 5 }, null);
    expect(counter).toEqual({ count: SNAPSHOT_EVERY + 2, ns: 20 });
    expect(snapshotDue(counter.count)).toBe(true);
  });

  test('a stored count grows by what arrived after it, without counting twice', () => {
    const scan = { messages: deltas(25, 30, 35), snapshotNs: null, cursor: 20 };
    expect(bootChangeCounter(scan, { count: 50, ns: 20 })).toEqual({ count: 53, ns: 35 });
    expect(bootChangeCounter(scan, { count: 50, ns: 30 })).toEqual({ count: 51, ns: 35 });
    expect(bootChangeCounter({ ...scan, snapshotNs: 10 }, { count: 50, ns: 30 })).toEqual({ count: 51, ns: 35 });
  });

  test('streamed messages count once, and a valid snapshot resets the count', () => {
    const counter = { count: 3, ns: 10 };
    expect(countSyncChange(counter, msg(10, READ))).toBe(counter);
    expect(countSyncChange(counter, msg(20, TEXT))).toBe(counter);
    expect(countSyncChange(counter, msg(20, READ))).toEqual({ count: 4, ns: 20 });
    expect(countSyncChange(counter, msg(30, SNAP, snapshot()))).toEqual({ count: 0, ns: 30 });
    expect(countSyncChange(counter, msg(30, SNAP, { bad: true }))).toEqual({ count: 3, ns: 30 });
  });

  test('parses a stored counter and rejects anything else', () => {
    expect(parseChangeCounter(null)).toBeNull();
    expect(parseChangeCounter('{"count":4,"ns":9}')).toEqual({ count: 4, ns: 9 });
    expect(parseChangeCounter('{"count":-1,"ns":9}')).toBeNull();
    expect(parseChangeCounter('garbage')).toBeNull();
  });
});

describe('assembleSyncSnapshot', () => {
  const row = (convId: string, over: Partial<CachedChannelRow> = {}): CachedChannelRow => ({ convId, unreadCount: 0, lastReadNs: 0, ...over });
  const base: SnapshotInputs = {
    rows: [], stored: new Map(), seen: new Set(), pinOrder: [], boardOrder: [], stamps: NO_SYNC_STAMPS, cleared: {}, groups: [], at: 99,
  };

  test('covers every row with a read and every stored conversation this device has seen', () => {
    const stored = new Map([
      ['d', { lastReadNs: 9, markedUnread: false, at: 44 }],
      ['e', { lastReadNs: 3, markedUnread: false, at: 12 }],
      ['f', { lastReadNs: 4, markedUnread: false, at: 13 }],
    ]);
    const rows = [row('a', { lastReadNs: 5 }), row('b', { unreadCount: 2 }), row('c', { markedUnread: true }), row('d', { lastReadNs: 7 })];
    const content = assembleSyncSnapshot({ ...base, rows, stored, seen: new Set(['e', 'g']) });
    expect(content.reads).toEqual({
      a: { lastReadNs: 5, markedUnread: false, at: 1 },
      c: { lastReadNs: 0, markedUnread: true, at: 1 },
      d: { lastReadNs: 9, markedUnread: false, at: 44 },
      e: { lastReadNs: 3, markedUnread: false, at: 12 },
    });
    expect(content.at).toBe(99);
    expect(parseSyncSnapshot(content)).toEqual(content);
    const listed = assembleSyncSnapshot({ ...base, rows, stored, groups: ['own', 'old'] });
    expect(listed.groups).toEqual(['own', 'old']);
    expect(parseSyncSnapshot(listed)).toEqual(listed);
  });

  test('records the pin order with its stamp, and an emptied order when pins were removed', () => {
    const stamps = { pin: { convId: 'p2', at: 50 }, boardAt: null };
    expect(assembleSyncSnapshot({ ...base, pinOrder: ['p1', 'p2'], stamps }).pins)
      .toEqual({ convId: 'p1', pinned: true, order: ['p1', 'p2'], at: 50 });
    expect(assembleSyncSnapshot({ ...base, pinOrder: ['p1'] }).pins?.at).toBe(1);
    expect(assembleSyncSnapshot({ ...base, stamps }).pins).toEqual({ convId: 'p2', pinned: false, order: [], at: 50 });
    expect(assembleSyncSnapshot(base).pins).toBeNull();
  });

  test('records the board order when there is one or when it was stamped', () => {
    const stamps = { pin: null, boardAt: 9 };
    expect(assembleSyncSnapshot(base).board).toBeNull();
    expect(assembleSyncSnapshot({ ...base, boardOrder: ['x'] }).board).toEqual({ order: ['x'], at: 1 });
    expect(assembleSyncSnapshot({ ...base, boardOrder: ['x'], stamps }).board).toEqual({ order: ['x'], at: 9 });
    expect(assembleSyncSnapshot({ ...base, stamps }).board).toEqual({ order: [], at: 9 });
  });
});

describe('sync stamps', () => {
  const pinAt = (convId: string, at: number) => ({ pin: { convId, at }, boardAt: null });

  test('parses stored stamps and rejects anything else', () => {
    const ok = { pin: { convId: 'p', at: 5 }, boardAt: 7 };
    expect(parseSyncStamps(JSON.stringify(ok))).toEqual(ok);
    expect(parseSyncStamps(JSON.stringify(NO_SYNC_STAMPS))).toEqual(NO_SYNC_STAMPS);
    expect(parseSyncStamps(null)).toBeNull();
    expect(parseSyncStamps('{"pin":null}')).toBeNull();
    expect(parseSyncStamps('{"pin":{"convId":"p","at":0},"boardAt":null}')).toBeNull();
    expect(parseSyncStamps('{')).toBeNull();
  });

  test('keeps the newer pin and board stamp from either side', () => {
    expect(mergeSyncStamps(pinAt('a', 5), pinAt('b', 9)).pin).toEqual({ convId: 'b', at: 9 });
    expect(mergeSyncStamps(pinAt('b', 9), pinAt('a', 5)).pin).toEqual({ convId: 'b', at: 9 });
    expect(mergeSyncStamps(NO_SYNC_STAMPS, pinAt('a', 5)).pin).toEqual({ convId: 'a', at: 5 });
    expect(mergeSyncStamps(pinAt('a', 5), NO_SYNC_STAMPS).pin).toEqual({ convId: 'a', at: 5 });
    expect(mergeSyncStamps({ pin: null, boardAt: 3 }, { pin: null, boardAt: 8 }).boardAt).toBe(8);
    expect(mergeSyncStamps({ pin: null, boardAt: 8 }, { pin: null, boardAt: 3 }).boardAt).toBe(8);
    expect(mergeSyncStamps({ pin: null, boardAt: 8 }, NO_SYNC_STAMPS).boardAt).toBe(8);
    expect(mergeSyncStamps(NO_SYNC_STAMPS, { pin: null, boardAt: 8 }).boardAt).toBe(8);
  });

  test('reads the stamps of the newest pin order and board order in a replay', () => {
    const replay = collectSnapshotReplay([
      msg(10, PIN, { convId: 'p', pinned: true, order: ['p'], at: 4 }),
      msg(20, PIN, { convId: 'q', pinned: true, at: 6 }),
      msg(30, BOARD, { order: ['x'], at: 3 }),
      msg(40, BOARD, { order: [], at: 5 }),
    ], 0);
    expect(replayStamps(replay)).toEqual({ pin: { convId: 'p', at: 4 }, boardAt: 5 });
    expect(replayStamps(collectSnapshotReplay([msg(20, PIN, { convId: 'q', pinned: true, at: 6 })], 0))).toEqual(NO_SYNC_STAMPS);
  });
});

describe('needsReadMark', () => {
  const row: CachedChannelRow = { convId: 'a', unreadCount: 0, lastReadNs: 10_000_000, lastTs: 10 };

  test('skips a row already read up to its newest message', () => {
    expect(needsReadMark(row, null)).toBe(false);
    expect(needsReadMark(row, 10)).toBe(false);
  });

  test('marks a row that is unread, marked unread, unknown or has newer messages', () => {
    expect(needsReadMark(undefined, null)).toBe(true);
    expect(needsReadMark({ ...row, unreadCount: 1 }, null)).toBe(true);
    expect(needsReadMark({ ...row, markedUnread: true }, null)).toBe(true);
    expect(needsReadMark(row, 11)).toBe(true);
    expect(needsReadMark({ ...row, lastTs: 12 }, null)).toBe(true);
  });
});
