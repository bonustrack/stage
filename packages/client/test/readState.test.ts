import { describe, expect, test } from 'bun:test';
import {
  isChatCleared, isRowCleared, revivesClearedChat, isSyncGroupName, isSyncType, mergeClearedChats, parseSyncState,
  shouldApplyReadState, syncGroupName, collectSyncReplay, pickPublishGroup, isOwnSyncGroup,
  type SyncGroupFacts, type SyncMessage, type SyncReplay,
} from '../src/xmtp/readState';

const ME = 'inbox-me';
const STRANGER = 'inbox-stranger';
const NOW = 1_000;
const DAY_MS = 86_400_000;
const MINE = { inboxId: ME, nowMs: NOW };
const READ = 'stage.box/readState:1.0';
const PIN = 'stage.box/pinState:1.0';
const CLEAR = 'stage.box/clearState:1.0';
const BOARD = 'stage.box/boardState:1.0';

function replayOf(messages: Omit<SyncMessage, 'senderInboxId'>[], afterNs = 0): SyncReplay {
  return collectSyncReplay(messages.map((m) => ({ ...m, senderInboxId: ME })), afterNs, MINE);
}

describe('read state payload', () => {
  test('parses a valid payload and rejects a malformed one', () => {
    const ok = { convId: 'c1', lastReadNs: 10, markedUnread: false, at: 1 };
    expect(parseSyncState('read', ok)).toEqual(ok);
    expect(parseSyncState('read', { convId: '', lastReadNs: 10, markedUnread: false, at: 1 })).toBeNull();
    expect(parseSyncState('read', 'nope')).toBeNull();
    expect(parseSyncState('read', { convId: 'c1', lastReadNs: -1, markedUnread: false, at: 1 })).toBeNull();
  });

  test('recognises the content type on native and web shapes', () => {
    expect(isSyncType('stage.box/readState:1.0', 'read')).toBe(true);
    expect(isSyncType('readState', 'read')).toBe(true);
    expect(isSyncType('xmtp.org/text:1.0', 'read')).toBe(false);
    expect(isSyncType(undefined, 'read')).toBe(false);
  });
});

describe('sync group identity', () => {
  test('derives a deterministic, case-insensitive name and recognises it', () => {
    expect(syncGroupName('0xABC')).toBe('stage.sync:0xabc');
    expect(syncGroupName('0xabc')).toBe(syncGroupName('0xABC'));
    expect(isSyncGroupName(syncGroupName('0xabc'))).toBe(true);
    expect(isSyncGroupName('Team chat')).toBe(false);
    expect(isSyncGroupName(undefined)).toBe(false);
  });
});

describe('shouldApplyReadState', () => {
  test('newer wins, equal or older is ignored', () => {
    expect(shouldApplyReadState(undefined, 5)).toBe(true);
    expect(shouldApplyReadState(4, 5)).toBe(true);
    expect(shouldApplyReadState(5, 5)).toBe(false);
    expect(shouldApplyReadState(6, 5)).toBe(false);
  });
});

describe('pin state payload', () => {
  test('parses a valid payload, rejects malformed ones, and recognises its type', () => {
    const ok = { convId: 'c1', pinned: true, at: 3 };
    expect(parseSyncState('pin', ok)).toEqual(ok);
    expect(parseSyncState('pin', { ...ok, order: ['c2', 'c1'] })?.order).toEqual(['c2', 'c1']);
    expect(parseSyncState('pin', { ...ok, order: [''] })).toBeNull();
    expect(parseSyncState('pin', { convId: 'c1', pinned: 'yes', at: 3 })).toBeNull();
    expect(isSyncType('stage.box/pinState:1.0', 'pin')).toBe(true);
    expect(isSyncType('stage.box/readState:1.0', 'pin')).toBe(false);
  });
});

describe('board state payload', () => {
  test('parses a valid payload, rejects malformed ones, and recognises its type', () => {
    const ok = { order: ['label:done', 'unlabeled'], at: 3 };
    expect(parseSyncState('board', ok)).toEqual(ok);
    expect(parseSyncState('board', { order: [''], at: 3 })).toBeNull();
    expect(parseSyncState('board', { order: ['label:done'], at: 0 })).toBeNull();
    expect(parseSyncState('board', { at: 3 })).toBeNull();
    expect(isSyncType('stage.box/boardState:1.0', 'board')).toBe(true);
    expect(isSyncType('stage.box/pinState:1.0', 'board')).toBe(false);
    expect(isSyncType('stage.box/boardState:1.0', 'pin')).toBe(false);
  });
});

describe('category order payload', () => {
  test('parses a valid payload, rejects malformed ones, and recognises only its own type', () => {
    const ok = { order: ['category:work', 'category:home'], at: 3 };
    expect(parseSyncState('categoryOrder', ok)).toEqual(ok);
    expect(parseSyncState('categoryOrder', { order: [''], at: 3 })).toBeNull();
    expect(parseSyncState('categoryOrder', { order: ['category:work'], at: 0 })).toBeNull();
    expect(isSyncType('stage.box/categoryOrderState:1.0', 'categoryOrder')).toBe(true);
    expect(isSyncType('stage.box/boardState:1.0', 'categoryOrder')).toBe(false);
    expect(isSyncType('stage.box/categoryOrderState:1.0', 'board')).toBe(false);
  });
});

describe('home view payload', () => {
  test('accepts status grouping and only defaults an unset column choice', () => {
    const state = { view: 'board', groupBy: 'status', at: 4 };
    expect(parseSyncState('homeView', state)).toEqual({ ...state, columnBy: 'status' });
    for (const columnBy of ['label', 'category', 'assignee', 'status']) {
      expect(parseSyncState('homeView', { ...state, columnBy })).toEqual({ ...state, columnBy });
    }
  });

  test('parses a valid payload, rejects malformed ones, and recognises its type', () => {
    const ok = { view: 'board', groupBy: 'none', columnBy: 'category', at: 3 };
    expect(parseSyncState('homeView', ok)).toEqual(ok);
    expect(parseSyncState('homeView', { ...ok, view: 'table' })).toBeNull();
    expect(parseSyncState('homeView', { ...ok, columnBy: 'none' })).toBeNull();
    expect(parseSyncState('homeView', { ...ok, groupBy: 'owner' })).toBeNull();
    expect(parseSyncState('homeView', { view: 'chats', at: 3 })).toBeNull();
    expect(isSyncType('stage.box/homeView:1.0', 'homeView')).toBe(true);
    expect(isSyncType('stage.box/boardState:1.0', 'homeView')).toBe(false);
    expect(isSyncType('stage.box/homeView:1.0', 'board')).toBe(false);
  });
});

describe('search state payload', () => {
  test('parses a valid payload, rejects malformed ones, and recognises its type', () => {
    const ok = { query: 'label:"to do" bob', labels: ['work'], unreadOnly: true, at: 3 };
    expect(parseSyncState('search', ok)).toEqual(ok);
    expect(parseSyncState('search', { ...ok, query: '' })?.query).toBe('');
    expect(parseSyncState('search', { ...ok, labels: [''] })).toBeNull();
    expect(parseSyncState('search', { ...ok, at: 0 })?.at).toBe(0);
    expect(parseSyncState('search', { ...ok, at: -1 })).toBeNull();
    expect(parseSyncState('search', { query: 'x', at: 3 })).toBeNull();
    expect(isSyncType('stage.box/searchState:1.0', 'search')).toBe(true);
    expect(isSyncType('stage.box/readState:1.0', 'search')).toBe(false);
    expect(isSyncType('stage.box/searchState:1.0', 'read')).toBe(false);
    expect(isSyncType('stage.box/searchState:1.0', 'board')).toBe(false);
  });
});

describe('deleted chats', () => {
  test('the payload is a map of peer to deletion time', () => {
    expect(parseSyncState('clear', { cleared: { '0xabc': 5 } })).toEqual({ cleared: { '0xabc': 5 } });
    expect(parseSyncState('clear', { cleared: { '0xabc': -1 } })).toBeNull();
    expect(parseSyncState('clear', { cleared: 'nope' })).toBeNull();
    expect(isSyncType('stage.box/clearState:1.0', 'clear')).toBe(true);
    expect(isSyncType('stage.box/pinState:1.0', 'clear')).toBe(false);
  });

  test('merging keeps the latest deletion per peer, so two devices never lose one', () => {
    const phone = { '0xaaa': 10, '0xbbb': 30 };
    const laptop = { '0xAAA': 20, '0xccc': 5 };
    expect(mergeClearedChats(phone, laptop)).toEqual({ '0xaaa': 20, '0xbbb': 30, '0xccc': 5 });
    expect(mergeClearedChats(laptop, phone)).toEqual(mergeClearedChats(phone, laptop));
  });

  test('a deleted chat stays hidden until a newer message arrives', () => {
    const cleared = { '0xaaa': 1000 };
    expect(isChatCleared(cleared, '0xAAA', 900)).toBe(true);
    expect(isChatCleared(cleared, '0xaaa', 1000)).toBe(true);
    expect(isChatCleared(cleared, '0xaaa', 1001)).toBe(false);
    expect(isChatCleared(cleared, '0xaaa', null)).toBe(true);
  });

  test('reactions and read receipts never bring a deleted chat back', () => {
    expect(revivesClearedChat('reaction')).toBe(false);
    expect(revivesClearedChat('readReceipt')).toBe(false);
    expect(revivesClearedChat('text')).toBe(true);
    expect(revivesClearedChat('remoteStaticAttachment')).toBe(true);
    expect(revivesClearedChat(undefined)).toBe(true);
  });

  test('a row is judged by its last real message, not a later reaction', () => {
    const cleared = { '0xaaa': 1000 };
    expect(isRowCleared(cleared, { peerAddress: '0xaaa', lastTs: 1500, lastBubbleTs: 800 })).toBe(true);
    expect(isRowCleared(cleared, { peerAddress: '0xaaa', lastTs: 1500, lastBubbleTs: 1200 })).toBe(false);
    expect(isRowCleared(cleared, { peerAddress: '0xaaa', lastTs: 1500 })).toBe(false);
    expect(isRowCleared(cleared, { peerAddress: null, lastTs: 1, lastBubbleTs: 1 })).toBe(false);
  });

  test('groups and chats that were never deleted are never hidden', () => {
    expect(isChatCleared({ '0xaaa': 1000 }, null, 1)).toBe(false);
    expect(isChatCleared({ '0xaaa': 1000 }, '0xbbb', 1)).toBe(false);
  });
});


describe('restored sync groups', () => {
  test('publishes only to a group this device is active in', () => {
    const groups = [
      { id: 'a-restored', createdAtNs: 1, active: false },
      { id: 'own', createdAtNs: 5, active: true },
    ];
    expect(pickPublishGroup(groups)?.id).toBe('own');
    expect(pickPublishGroup([{ id: 'a-restored', createdAtNs: 1, active: false }])).toBeNull();
  });

  test('devices converge on the lowest id once they are active in the same groups', () => {
    const laptop = [{ id: 'g2', createdAtNs: 1, active: true }, { id: 'g1', createdAtNs: 9, active: true }];
    const phone = [{ id: 'g1', createdAtNs: 2, active: true }, { id: 'g2', createdAtNs: 3, active: true }];
    expect(pickPublishGroup(laptop)?.id).toBe('g1');
    expect(pickPublishGroup(phone)?.id).toBe('g1');
  });

  test('collapses a long replay into the latest state per conversation', () => {
    const replay = replayOf([
      { contentTypeId: READ, content: { convId: 'a', lastReadNs: 5, markedUnread: false, at: 2 }, sentNs: 10 },
      { contentTypeId: READ, content: { convId: 'a', lastReadNs: 9, markedUnread: false, at: 4 }, sentNs: 11 },
      { contentTypeId: READ, content: { convId: 'a', lastReadNs: 1, markedUnread: true, at: 3 }, sentNs: 12 },
      { contentTypeId: READ, content: { convId: 'b', lastReadNs: 7, markedUnread: false, at: 1 }, sentNs: 13 },
      { contentTypeId: CLEAR, content: { cleared: { '0xAA': 5 } }, sentNs: 14 },
      { contentTypeId: CLEAR, content: { cleared: { '0xaa': 3, '0xbb': 8 } }, sentNs: 15 },
      { contentTypeId: 'xmtp.org/text:1.0', content: 'hi', sentNs: 16 },
    ]);
    expect(replay.reads).toEqual([
      { convId: 'a', lastReadNs: 9, markedUnread: false, at: 4 },
      { convId: 'b', lastReadNs: 7, markedUnread: false, at: 1 },
    ]);
    expect(replay.cleared).toEqual({ '0xaa': 5, '0xbb': 8 });
    expect(replay.latestNs).toBe(16);
  });

  test('keeps pins from the last full order onwards, in time order', () => {
    const replay = replayOf([
      { contentTypeId: PIN, content: { convId: 'x', pinned: true, at: 1 }, sentNs: 1 },
      { contentTypeId: PIN, content: { convId: 'y', pinned: true, at: 3, order: ['y'] }, sentNs: 2 },
      { contentTypeId: PIN, content: { convId: 'z', pinned: true, at: 4 }, sentNs: 3 },
      { contentTypeId: PIN, content: { convId: 'w', pinned: true, at: 2, order: ['w'] }, sentNs: 4 },
    ]);
    expect(replay.pins.map((p) => p.convId)).toEqual(['y', 'z']);
  });

  test('keeps the newest board order by its own clock, not by arrival', () => {
    const replay = replayOf([
      { contentTypeId: BOARD, content: { order: ['label:a'], at: 5 }, sentNs: 1 },
      { contentTypeId: BOARD, content: { order: ['label:b'], at: 9 }, sentNs: 2 },
      { contentTypeId: BOARD, content: { order: ['label:c'], at: 7 }, sentNs: 3 },
      { contentTypeId: BOARD, content: { order: [''], at: 12 }, sentNs: 4 },
    ]);
    expect(replay.latest.board).toEqual({ order: ['label:b'], at: 9 });
    expect(replayOf([]).latest.board).toBeNull();
  });

  test('keeps the newest category order by its own clock, not by arrival', () => {
    const CATEGORY = 'stage.box/categoryOrderState:1.0';
    const replay = replayOf([
      { contentTypeId: CATEGORY, content: { order: ['category:a'], at: 5 }, sentNs: 1 },
      { contentTypeId: CATEGORY, content: { order: ['category:b'], at: 9 }, sentNs: 2 },
      { contentTypeId: 'stage.box/boardState:1.0', content: { order: ['label:c'], at: 12 }, sentNs: 3 },
    ]);
    expect(replay.latest.categoryOrder).toEqual({ order: ['category:b'], at: 9 });
    expect(replay.latest.board).toEqual({ order: ['label:c'], at: 12 });
    expect(replayOf([]).latest.categoryOrder).toBeNull();
  });

  test('keeps the newest search by its own clock, not by arrival', () => {
    const SEARCH = 'stage.box/searchState:1.0';
    const search = (query: string, at: number): { query: string; labels: string[]; unreadOnly: boolean; at: number } => (
      { query, labels: [], unreadOnly: false, at }
    );
    const replay = replayOf([
      { contentTypeId: SEARCH, content: search('a', 5), sentNs: 1 },
      { contentTypeId: SEARCH, content: search('b', 9), sentNs: 2 },
      { contentTypeId: SEARCH, content: search('c', 7), sentNs: 3 },
      { contentTypeId: SEARCH, content: { query: 'd', at: 12 }, sentNs: 4 },
    ]);
    expect(replay.latest.search).toEqual(search('b', 9));
    expect(replay.latest.board).toBeNull();
    expect(replayOf([]).latest.search).toBeNull();
  });

  test('keeps the newest home view by its own clock, not by arrival', () => {
    const VIEW = 'stage.box/homeView:1.0';
    const view = (groupBy: string, at: number): Record<string, unknown> => ({ view: 'chats', groupBy, columnBy: 'label', at });
    const replay = replayOf([
      { contentTypeId: VIEW, content: view('label', 5), sentNs: 1 },
      { contentTypeId: VIEW, content: view('assignee', 9), sentNs: 2 },
      { contentTypeId: VIEW, content: view('category', 7), sentNs: 3 },
      { contentTypeId: VIEW, content: view('owner', 12), sentNs: 4 },
    ]);
    expect(replay.latest.homeView).toEqual(view('assignee', 9));
    expect(replayOf([]).latest.homeView).toBeNull();
  });

  test('keeps the newest dashboard by its own clock and never reads it as a board', () => {
    const DASHBOARD = 'stage.box/dashboardLayout:1.0';
    const frame = (id: string, w = 'half', h = 1): Record<string, unknown> => ({
      id, w, h, kind: 'frame', source: { conversationId: 'conv', messageId: id },
    });
    const replay = replayOf([
      { contentTypeId: DASHBOARD, content: { widgets: [frame('a')], at: 5 }, sentNs: 1 },
      { contentTypeId: DASHBOARD, content: { widgets: [frame('b', 'full', 2), frame('x', 'wide')], at: 9 }, sentNs: 2 },
      { contentTypeId: DASHBOARD, content: { widgets: [frame('c', 'quarter')], at: 7 }, sentNs: 3 },
      { contentTypeId: DASHBOARD, content: { widgets: [], at: NOW + DAY_MS + 1 }, sentNs: 4 },
      { contentTypeId: DASHBOARD, content: { widgets: [frame('d')] }, sentNs: 5 },
    ]);
    expect(replay.latest.dashboard).toEqual({ widgets: [frame('b', 'full', 2)], at: 9 });
    expect(replay.latest.board).toBeNull();
    expect(isSyncType(DASHBOARD, 'board')).toBe(false);
    expect(isSyncType(DASHBOARD, 'dashboard')).toBe(true);
    expect(replayOf([]).latest.dashboard).toBeNull();
  });

  test('replays the latest supplied sort choices across newer legacy snapshots', () => {
    const VIEW = 'stage.box/homeView:1.0';
    const base = { view: 'chats', groupBy: 'none', columnBy: 'status', at: 10 };
    const chatsSort = { by: 'created', direction: 'asc' };
    const boardSort = { by: 'updated', direction: 'desc' };
    const messages = [
      { contentTypeId: VIEW, content: { ...base, chatsSort, boardSort }, sentNs: 1 },
      { contentTypeId: VIEW, content: { ...base, chatsSort: { by: 'priority', direction: 'asc' }, at: 11 }, sentNs: 2 },
      { contentTypeId: VIEW, content: { ...base, groupBy: 'category', at: 12 }, sentNs: 3 },
      { contentTypeId: VIEW, content: { ...base, chatsSort, at: NOW + DAY_MS + 1 }, sentNs: 4 },
      { contentTypeId: VIEW, content: { ...base, chatsSort: { by: 'unknown' }, at: 13 }, sentNs: 5 },
    ];
    const expected = { ...base, groupBy: 'category', at: 12, chatsSort: { by: 'priority', direction: 'asc' }, boardSort };
    expect(replayOf(messages).latest.homeView).toEqual(expected);
    expect(replayOf([...messages].reverse()).latest.homeView).toEqual(expected);
    expect(replayOf(messages, 2).latest.homeView).toEqual({ ...base, groupBy: 'category', at: 12 });
  });

  test('skips messages at or before the cursor', () => {
    const replay = replayOf([
      { contentTypeId: READ, content: { convId: 'a', lastReadNs: 5, markedUnread: false, at: 2 }, sentNs: 10 },
    ], 10);
    expect(replay.reads).toEqual([]);
    expect(replay.cleared).toBeNull();
    expect(replay.latestNs).toBe(10);
  });
});

describe('sync group trust', () => {
  const OWNER = { address: '0xAbC', inboxId: ME };
  const own = (id: string, active = true): SyncGroupFacts => ({
    id, createdAtNs: 1, active, name: syncGroupName('0xabc'), addedByInboxId: ME, memberInboxIds: [ME, ME],
  });

  test('a group with your sync name is yours only when you made it and only you are in it', () => {
    expect(isOwnSyncGroup(own('g'), OWNER)).toBe(true);
    expect(isOwnSyncGroup({ ...own('g'), memberInboxIds: [ME, STRANGER] }, OWNER)).toBe(false);
    expect(isOwnSyncGroup({ ...own('g'), addedByInboxId: STRANGER }, OWNER)).toBe(false);
    expect(isOwnSyncGroup({ ...own('g'), addedByInboxId: undefined }, OWNER)).toBe(false);
    expect(isOwnSyncGroup({ ...own('g'), name: syncGroupName('0xdef') }, OWNER)).toBe(false);
    expect(isOwnSyncGroup({ ...own('g'), memberInboxIds: [] }, OWNER)).toBe(false);
    expect(isOwnSyncGroup(own('g'), { ...OWNER, inboxId: '' })).toBe(false);
  });

  test('a restored group lists no members until it is re-added, and is only read', () => {
    const restored = { ...own('a-restored', false), memberInboxIds: [] };
    expect(isOwnSyncGroup(restored, OWNER)).toBe(true);
    expect(isOwnSyncGroup({ ...restored, memberInboxIds: [STRANGER] }, OWNER)).toBe(false);
    expect(pickPublishGroup([restored])).toBeNull();
  });

  test('a foreign group with your sync name is never read or written, even with the lowest id', () => {
    const foreign = { ...own('a-foreign'), addedByInboxId: STRANGER, memberInboxIds: [STRANGER, ME] };
    const left = { ...own('a-left'), addedByInboxId: STRANGER, memberInboxIds: [ME] };
    const mine = [foreign, left, own('c-phone'), own('b-laptop')].filter((g) => isOwnSyncGroup(g, OWNER));
    expect(mine.map((g) => g.id)).toEqual(['c-phone', 'b-laptop']);
    expect(pickPublishGroup(mine)?.id).toBe('b-laptop');
  });

  test('ignores sync messages your own inbox did not send', () => {
    const messages = [
      { contentTypeId: READ, content: { convId: 'a', lastReadNs: 5, markedUnread: false, at: 2 }, senderInboxId: ME, sentNs: 1 },
      { contentTypeId: READ, content: { convId: 'a', lastReadNs: 9, markedUnread: true, at: 9 }, senderInboxId: STRANGER, sentNs: 2 },
      { contentTypeId: CLEAR, content: { cleared: { '0xaa': 900 } }, senderInboxId: STRANGER, sentNs: 3 },
      { contentTypeId: PIN, content: { convId: 'p', pinned: true, at: 9, order: ['p'] }, senderInboxId: STRANGER, sentNs: 4 },
      { contentTypeId: BOARD, content: { order: ['label:x'], at: 9 }, senderInboxId: STRANGER, sentNs: 5 },
    ];
    const replay = collectSyncReplay(messages, 0, MINE);
    expect(replay.reads).toEqual([{ convId: 'a', lastReadNs: 5, markedUnread: false, at: 2 }]);
    expect(replay.cleared).toBeNull();
    expect(replay.pins).toEqual([]);
    expect(replay.latest.board).toBeNull();
    expect(collectSyncReplay(messages, 0, { ...MINE, inboxId: '' }).reads).toEqual([]);
  });

  test('ignores states dated more than a day ahead', () => {
    const replay = replayOf([
      { contentTypeId: READ, content: { convId: 'a', lastReadNs: 5, markedUnread: false, at: 2 }, sentNs: 1 },
      { contentTypeId: READ, content: { convId: 'a', lastReadNs: 9, markedUnread: true, at: NOW + DAY_MS + 1 }, sentNs: 2 },
      { contentTypeId: CLEAR, content: { cleared: { '0xaa': NOW + DAY_MS + 1, '0xbb': NOW } }, sentNs: 3 },
      { contentTypeId: PIN, content: { convId: 'p', pinned: true, at: NOW + 10 * DAY_MS, order: ['p'] }, sentNs: 4 },
      { contentTypeId: BOARD, content: { order: ['label:now'], at: NOW + DAY_MS }, sentNs: 5 },
      { contentTypeId: BOARD, content: { order: ['label:late'], at: NOW + DAY_MS + 1 }, sentNs: 6 },
    ]);
    expect(replay.reads).toEqual([{ convId: 'a', lastReadNs: 5, markedUnread: false, at: 2 }]);
    expect(replay.cleared).toEqual({ '0xbb': NOW });
    expect(replay.pins).toEqual([]);
    expect(replay.latest.board).toEqual({ order: ['label:now'], at: NOW + DAY_MS });
  });
});
