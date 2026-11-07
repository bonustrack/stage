import { describe, expect, test } from 'bun:test';
import { channelStampSeed, stampAvatarUrl } from '@stage-labs/kit/avatar';
import { seedPeerProfiles } from '../lib/peerProfiles';
import {
  accountName,
  chatLabelOf,
  channelAvatar,
  channelAvatarUrl,
  channelTitle,
  convTitle,
  profileDisplayName,
  rowAvatarAddress,
  rowTitle,
} from '../lib/convIdentity';

const NAMED = '0x1111111111111111111111111111111111111111';
const UNKNOWN = '0x2222222222222222222222222222222222222222';
const CONV = 'a'.repeat(32);

seedPeerProfiles({ [NAMED]: 'alice.base.eth' });

describe('conversation titles', () => {
  test('names the chat a file or a frame was sent in', () => {
    const unnamed = 'Unnamed channel';
    expect(chatLabelOf({ peerAddress: NAMED, groupName: '' }, unnamed)).toBe('alice.base.eth');
    expect(chatLabelOf({ peerAddress: UNKNOWN, groupName: '' }, unnamed)).toBe('0x2222…2222');
    expect(chatLabelOf({ peerAddress: null, groupName: ' Design ' }, unnamed)).toBe('Design');
    expect(chatLabelOf({ peerAddress: null, groupName: '' }, unnamed)).toBe(unnamed);
    expect(chatLabelOf(null, unnamed)).toBe('');
  });

  test('a channel without a name shows the caller placeholder, dimmed', () => {
    expect(channelTitle('  Design  ', 'Untitled channel')).toEqual({ text: 'Design', placeholder: false });
    expect(channelTitle(' ', 'Untitled channel')).toEqual({ text: 'Untitled channel', placeholder: true });
    expect(channelTitle(null, 'Channel')).toEqual({ text: 'Channel', placeholder: true });
  });

  test('a direct chat is named after the peer, or their short address before the name resolves', () => {
    expect(convTitle({ isGroup: false, groupName: null, peerAddr: NAMED }, 'Untitled channel').text).toBe('alice.base.eth');
    expect(convTitle({ isGroup: false, groupName: null, peerAddr: UNKNOWN }, 'Untitled channel').text).toBe('0x2222…2222');
  });

  test('nothing shows while the channel name or the peer is still loading', () => {
    expect(convTitle({ isGroup: true, groupName: null, peerAddr: null }, 'Untitled channel')).toEqual({ text: '', placeholder: false });
    expect(convTitle({ isGroup: false, groupName: null, peerAddr: null }, 'Untitled channel')).toEqual({ text: '', placeholder: false });
  });

  test('a chat list row keeps its stored title for channels and dims it when the channel is unnamed', () => {
    expect(rowTitle({ peerAddress: null, title: '3 members', groupName: '' })).toEqual({ text: '3 members', placeholder: true });
    expect(rowTitle({ peerAddress: null, title: 'Design', groupName: 'Design' })).toEqual({ text: 'Design', placeholder: false });
    expect(rowTitle({ peerAddress: NAMED, title: '0x1111…1111', groupName: '' })).toEqual({ text: 'alice.base.eth', placeholder: false });
  });
});

describe('profile names', () => {
  test('a profile shows its peer label, or a loading placeholder before its address is known', () => {
    expect(profileDisplayName(NAMED)).toBe('alice.base.eth');
    expect(profileDisplayName(UNKNOWN)).toBe('0x2222…2222');
    expect(profileDisplayName('')).toBe('Loading…');
  });
});

describe('account names', () => {
  test('an account shows its profile name, then its device label, then its short address', () => {
    expect(accountName({ address: NAMED, label: 'Main' }, 'alice.base.eth')).toBe('alice.base.eth');
    expect(accountName({ address: UNKNOWN, label: ' Main ' }, undefined)).toBe('Main');
    expect(accountName({ address: UNKNOWN, label: '  ' }, null)).toBe('0x2222…2222');
    expect(accountName({ address: UNKNOWN })).toBe('0x2222…2222');
  });
});

describe('conversation avatars', () => {
  test('a channel shows its uploaded picture, else the stamp drawn from its id', () => {
    expect(channelAvatar(CONV, ' https://img/a.png ')).toEqual({ avatarUri: 'https://img/a.png', avatarAddress: null });
    expect(channelAvatar(CONV, '')).toEqual({ avatarUri: null, avatarAddress: channelStampSeed(CONV) });
    expect(channelAvatar('', '')).toEqual({ avatarUri: null, avatarAddress: null });
  });

  test('the channel picture URL renders IPFS pictures through the gateway and falls back to the stamp', () => {
    expect(channelAvatarUrl(CONV, 'ipfs://cid', 64)).toBe('https://snapshot.4everland.link/ipfs/cid');
    expect(channelAvatarUrl(CONV, '', 64)).toBe(stampAvatarUrl(channelStampSeed(CONV), 64));
    expect(channelAvatarUrl('', '', 64)).toBe('');
  });

  test('a row shows a peer avatar only once the peer profile resolved', () => {
    expect(rowAvatarAddress({ avatarUri: null, avatarAddress: NAMED, peerAddress: NAMED })).toBe(NAMED);
    expect(rowAvatarAddress({ avatarUri: null, avatarAddress: UNKNOWN, peerAddress: UNKNOWN })).toBeNull();
    expect(rowAvatarAddress({ avatarUri: null, avatarAddress: channelStampSeed(CONV), peerAddress: null })).toBe(channelStampSeed(CONV));
    expect(rowAvatarAddress({ avatarUri: 'https://img/a.png', avatarAddress: null, peerAddress: null })).toBeNull();
  });
});
