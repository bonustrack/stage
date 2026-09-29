import { describe, expect, test } from 'bun:test';
import { channelProfileLinkOf, isActiveConversationPath, profileKindOf, profileLinkOf } from '../lib/conversationLink';

const PEER = '0x1234567890AbcdEF1234567890aBcDeF12345678';
const CHANNEL = '449ce5e585c1ed5db256b6fd7cbd60e7';
const INBOX = 'f6378cd94726dabde1bb306540ccced0d57352d37a33212076bdcde91f23705a';

describe('isActiveConversationPath', () => {
  test('matches a channel on its own route', () => {
    expect(isActiveConversationPath('/channel/conv-1', 'conv-1', null)).toBe(true);
  });

  test('rejects a different channel', () => {
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

  test('does not confuse a channel with a dm on a same-named route', () => {
    expect(isActiveConversationPath(`/channel/${PEER}`, 'conv-1', PEER)).toBe(false);
  });

  test('matches a dm opened by conversation id, as notification deep links do', () => {
    expect(isActiveConversationPath('/channel/conv-1', 'conv-1', PEER)).toBe(true);
  });
});

describe('profileKindOf', () => {
  test('a 32 hex conversation id is a channel, whatever its case', () => {
    expect(profileKindOf(CHANNEL)).toBe('channel');
    expect(profileKindOf(CHANNEL.toUpperCase())).toBe('channel');
    expect(profileKindOf(` ${CHANNEL} `)).toBe('channel');
  });

  test('addresses, inbox ids and names are users', () => {
    expect(profileKindOf(PEER)).toBe('user');
    expect(profileKindOf(PEER.toLowerCase())).toBe('user');
    expect(profileKindOf(INBOX)).toBe('user');
    expect(profileKindOf('boorger')).toBe('user');
    expect(profileKindOf('emma123.stage.base.eth')).toBe('user');
    expect(profileKindOf('vitalik.eth')).toBe('user');
  });

  test('near misses and empty ids are users', () => {
    expect(profileKindOf(CHANNEL.slice(1))).toBe('user');
    expect(profileKindOf(`${CHANNEL}0`)).toBe('user');
    expect(profileKindOf(`${CHANNEL.slice(1)}g`)).toBe('user');
    expect(profileKindOf('')).toBe('user');
    expect(profileKindOf(undefined)).toBe('user');
    expect(profileKindOf(null)).toBe('user');
  });
});

describe('profile links', () => {
  test('a channel profile and the old /group redirect both land on /profile/<channel id>', () => {
    expect(channelProfileLinkOf(CHANNEL)).toEqual({ pathname: '/profile/[id]', params: { id: CHANNEL } });
    expect(profileKindOf(channelProfileLinkOf(CHANNEL).params.id)).toBe('channel');
  });

  test('a user profile shares the route and never reads as a channel', () => {
    expect(profileLinkOf(PEER)).toEqual({ pathname: '/profile/[id]', params: { id: PEER.toLowerCase() } });
    expect(profileLinkOf(PEER, 'boorger.stage.base.eth')).toEqual({ pathname: '/profile/[id]', params: { id: 'boorger' } });
    expect(profileKindOf(profileLinkOf(PEER).params.id)).toBe('user');
  });
});
