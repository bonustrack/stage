import { describe, expect, test } from 'bun:test';
import {
  isChatCleared, isClearStateType, isRowCleared, revivesClearedChat, isPinStateType, isReadStateType, isSyncGroupName, mergeClearedChats,
  parseClearState, parsePinState, parseReadState, pickSyncGroup, shouldApplyReadState, syncGroupName,
  collectSyncReplay, pickPublishGroup,
} from '../src/xmtp/readState';

describe('read state payload', () => {
  test('parses a valid payload and rejects a malformed one', () => {
    const ok = { convId: 'c1', lastReadNs: 10, markedUnread: false, at: 1 };
    expect(parseReadState(ok)).toEqual(ok);
    expect(parseReadState({ convId: '', lastReadNs: 10, markedUnread: false, at: 1 })).toBeNull();
    expect(parseReadState('nope')).toBeNull();
    expect(parseReadState({ convId: 'c1', lastReadNs: -1, markedUnread: false, at: 1 })).toBeNull();
  });

  test('recognises the content type on native and web shapes', () => {
    expect(isReadStateType('stage.box/readState:1.0')).toBe(true);
    expect(isReadStateType('readState')).toBe(true);
    expect(isReadStateType('xmtp.org/text:1.0')).toBe(false);
    expect(isReadStateType(undefined)).toBe(false);
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

  test('picks the oldest group, then the lowest id, so every device agrees', () => {
    const groups = [
      { id: 'b', createdAtNs: 20 },
      { id: 'c', createdAtNs: 10 },
      { id: 'a', createdAtNs: 10 },
    ];
    expect(pickSyncGroup(groups)?.id).toBe('a');
    expect(pickSyncGroup([])).toBeNull();
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
    expect(parsePinState(ok)).toEqual(ok);
    expect(parsePinState({ ...ok, order: ['c2', 'c1'] })?.order).toEqual(['c2', 'c1']);
    expect(parsePinState({ ...ok, order: [''] })).toBeNull();
    expect(parsePinState({ convId: 'c1', pinned: 'yes', at: 3 })).toBeNull();
    expect(isPinStateType('stage.box/pinState:1.0')).toBe(true);
    expect(isPinStateType('stage.box/readState:1.0')).toBe(false);
  });
});

describe('deleted chats', () => {
  test('the payload is a map of peer to deletion time', () => {
    expect(parseClearState({ cleared: { '0xabc': 5 } })).toEqual({ cleared: { '0xabc': 5 } });
    expect(parseClearState({ cleared: { '0xabc': -1 } })).toBeNull();
    expect(parseClearState({ cleared: 'nope' })).toBeNull();
    expect(isClearStateType('stage.box/clearState:1.0')).toBe(true);
    expect(isClearStateType('stage.box/pinState:1.0')).toBe(false);
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

  const READ = 'stage.box/readState:1.0';
  const PIN = 'stage.box/pinState:1.0';
  const CLEAR = 'stage.box/clearState:1.0';

  test('collapses a long replay into the latest state per conversation', () => {
    const replay = collectSyncReplay([
      { contentTypeId: READ, content: { convId: 'a', lastReadNs: 5, markedUnread: false, at: 2 }, sentNs: 10 },
      { contentTypeId: READ, content: { convId: 'a', lastReadNs: 9, markedUnread: false, at: 4 }, sentNs: 11 },
      { contentTypeId: READ, content: { convId: 'a', lastReadNs: 1, markedUnread: true, at: 3 }, sentNs: 12 },
      { contentTypeId: READ, content: { convId: 'b', lastReadNs: 7, markedUnread: false, at: 1 }, sentNs: 13 },
      { contentTypeId: CLEAR, content: { cleared: { '0xAA': 5 } }, sentNs: 14 },
      { contentTypeId: CLEAR, content: { cleared: { '0xaa': 3, '0xbb': 8 } }, sentNs: 15 },
      { contentTypeId: 'xmtp.org/text:1.0', content: 'hi', sentNs: 16 },
    ], 0);
    expect(replay.reads).toEqual([
      { convId: 'a', lastReadNs: 9, markedUnread: false, at: 4 },
      { convId: 'b', lastReadNs: 7, markedUnread: false, at: 1 },
    ]);
    expect(replay.cleared).toEqual({ '0xaa': 5, '0xbb': 8 });
    expect(replay.latestNs).toBe(16);
  });

  test('keeps pins from the last full order onwards, in time order', () => {
    const replay = collectSyncReplay([
      { contentTypeId: PIN, content: { convId: 'x', pinned: true, at: 1 }, sentNs: 1 },
      { contentTypeId: PIN, content: { convId: 'y', pinned: true, at: 3, order: ['y'] }, sentNs: 2 },
      { contentTypeId: PIN, content: { convId: 'z', pinned: true, at: 4 }, sentNs: 3 },
      { contentTypeId: PIN, content: { convId: 'w', pinned: true, at: 2, order: ['w'] }, sentNs: 4 },
    ], 0);
    expect(replay.pins.map((p) => p.convId)).toEqual(['y', 'z']);
  });

  test('skips messages at or before the cursor', () => {
    const replay = collectSyncReplay([
      { contentTypeId: READ, content: { convId: 'a', lastReadNs: 5, markedUnread: false, at: 2 }, sentNs: 10 },
    ], 10);
    expect(replay.reads).toEqual([]);
    expect(replay.cleared).toBeNull();
    expect(replay.latestNs).toBe(10);
  });
});
