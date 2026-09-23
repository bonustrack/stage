import { describe, expect, test } from 'bun:test';
import {
  isChatCleared, isClearStateType, isRowCleared, revivesClearedChat, isPinStateType, isReadStateType, isSyncGroupName, mergeClearedChats,
  parseClearState, parsePinState, parseReadState, pickSyncGroup, shouldApplyReadState, syncGroupName,
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

