import { describe, expect, test } from 'bun:test';
import { channelLinkOf, channelProfileLinkOf, mailLinkOf, routeForUrl } from '@stage-labs/client/routing/deepLinks';
import { profileKindOf } from '@stage-labs/client/routing/handles';
import { conversationLinkOf, dmLinkOf, isActiveConversationPath, messageShareUrlOf, profileLinkOf } from '../lib/links';

const PEER = '0x1234567890AbcdEF1234567890aBcDeF12345678';
const CHANNEL = '449ce5e585c1ed5db256b6fd7cbd60e7';
const INBOX = 'f6378cd94726dabde1bb306540ccced0d57352d37a33212076bdcde91f23705a';

describe('isActiveConversationPath', () => {
  test.each([
    ['matches a channel on its own route', '/channel/conv-1', null, true],
    ['rejects a different channel', '/channel/conv-2', null, false],
    ['matches a dm on the peer-address route', `/${PEER}`, PEER, true],
    ['matches a dm regardless of address casing', `/${PEER.toLowerCase()}`, PEER, true],
    ['rejects a dm whose peer is not the open one', `/${PEER}`, '0xdead', false],
    ['never matches when no route is supplied', '', null, false],
    ['does not confuse a channel with a dm on a same-named route', `/channel/${PEER}`, PEER, false],
    ['matches a dm opened by conversation id, as notification deep links do', '/channel/conv-1', PEER, true],
  ] as const)('%s', (_name, path, peer, active) => {
    expect(isActiveConversationPath(path, 'conv-1', peer)).toBe(active);
  });

  test('never matches the channels list itself', () => {
    expect(isActiveConversationPath('/', 'conv-1', null)).toBe(false);
    expect(isActiveConversationPath('/', 'conv-1', PEER)).toBe(false);
  });
});

describe('profileKindOf', () => {
  test('a 32 hex conversation id is a channel, whatever its case', () => {
    for (const id of [CHANNEL, CHANNEL.toUpperCase(), ` ${CHANNEL} `]) expect(profileKindOf(id)).toBe('channel');
  });

  test('addresses, inbox ids and names are users', () => {
    for (const id of [PEER, PEER.toLowerCase(), INBOX, 'boorger', 'emma123.stage.base.eth', 'vitalik.eth'])
      expect(profileKindOf(id)).toBe('user');
  });

  test('near misses and empty ids are users', () => {
    for (const id of [CHANNEL.slice(1), `${CHANNEL}0`, `${CHANNEL.slice(1)}g`, '', undefined, null]) expect(profileKindOf(id)).toBe('user');
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

describe('conversation links', () => {
  test('a chat with a person opens at their Stage label, else at their address', () => {
    expect(dmLinkOf(PEER, 'boorger.stage.base.eth')).toEqual({ pathname: '/[convId]', params: { convId: 'boorger' } });
    expect(dmLinkOf(PEER, null)).toEqual({ pathname: '/[convId]', params: { convId: PEER.toLowerCase() } });
    expect(conversationLinkOf('conv-1', PEER, 'boorger.stage.base.eth')).toEqual(dmLinkOf(PEER, 'boorger.stage.base.eth'));
    expect(conversationLinkOf(CHANNEL, null)).toEqual(channelLinkOf(CHANNEL));
  });

  test('a person named like an app page gets an address link, and that page never highlights their chat', () => {
    for (const label of ['settings', 'signup', 'import', 'account']) {
      const handle = `${label}.stage.base.eth`;
      expect(dmLinkOf(PEER, handle).params.convId).toBe(PEER.toLowerCase());
      expect(isActiveConversationPath(`/${label}`, 'conv-1', PEER, handle)).toBe(false);
      expect(isActiveConversationPath(`/${PEER.toLowerCase()}`, 'conv-1', PEER, handle)).toBe(true);
    }
  });
});

describe('links the app reads back', () => {
  test('a mail link opens the same mail, whatever its label and id hold', () => {
    expect(routeForUrl(mailLinkOf('work inbox', 'id&1=2'))).toEqual({
      pathname: '/inbox/mail',
      params: { label: 'work inbox', id: 'id&1=2' },
    });
  });

  test('a shared message link opens its conversation and carries the message id', () => {
    expect(routeForUrl(messageShareUrlOf(CHANNEL, null, 'msg-1'))).toEqual({
      pathname: '/channel/[convId]',
      params: { convId: CHANNEL, m: 'msg-1' },
    });
    expect(routeForUrl(messageShareUrlOf('conv-1', PEER, 'msg-2'))).toEqual({
      pathname: '/[convId]',
      params: { convId: PEER.toLowerCase(), m: 'msg-2' },
    });
  });
});
