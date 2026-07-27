import { describe, expect, test } from 'bun:test';
import { isActiveConversationPath } from '../lib/conversationLink';

const PEER = '0x1234567890AbcdEF1234567890aBcDeF12345678';

describe('isActiveConversationPath', () => {
  test('matches a group channel on its own route', () => {
    expect(isActiveConversationPath('/channel/conv-1', 'conv-1', null)).toBe(true);
  });

  test('rejects a different group channel', () => {
    expect(isActiveConversationPath('/channel/conv-2', 'conv-1', null)).toBe(false);
  });

  test('matches a dm on the peer-address route', () => {
    expect(isActiveConversationPath(`/${PEER}`, 'conv-1', PEER)).toBe(true);
  });

  test('matches a dm regardless of address casing', () => {
    expect(isActiveConversationPath(`/${PEER.toLowerCase()}`, 'conv-1', PEER)).toBe(true);
  });

  test('rejects a dm whose peer is not the open one', () => {
    expect(isActiveConversationPath(`/${PEER}`, 'conv-1', '0xdead')).toBe(false);
  });

  test('never matches the channels list itself', () => {
    expect(isActiveConversationPath('/', 'conv-1', null)).toBe(false);
    expect(isActiveConversationPath('/', 'conv-1', PEER)).toBe(false);
  });

  test('never matches when no route is supplied', () => {
    expect(isActiveConversationPath('', 'conv-1', null)).toBe(false);
  });

  test('does not confuse a group with a dm on a same-named route', () => {
    expect(isActiveConversationPath(`/channel/${PEER}`, 'conv-1', PEER)).toBe(false);
  });

  test('matches a dm opened by conversation id, as notification deep links do', () => {
    expect(isActiveConversationPath('/channel/conv-1', 'conv-1', PEER)).toBe(true);
  });
});
