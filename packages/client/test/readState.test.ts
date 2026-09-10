import { describe, expect, test } from 'bun:test';
import {
  isPinStateType, isReadStateType, isSyncGroupName, parsePinState, parseReadState, pickSyncGroup,
  shouldApplyReadState, syncGroupName,
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
    expect(parsePinState({ convId: 'c1', pinned: 'yes', at: 3 })).toBeNull();
    expect(isPinStateType('stage.box/pinState:1.0')).toBe(true);
    expect(isPinStateType('stage.box/readState:1.0')).toBe(false);
  });
});
