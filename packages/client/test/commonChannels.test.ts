import { describe, expect, test } from 'bun:test';
import { resolveCommonChannels, type ChannelAvatarSeed, type CommonChannel, type CommonChannelRow } from '../src/xmtp/commonChannels';

const PEER = '0xPeerAddress';

const shared = async (row: CommonChannelRow, seedOf?: ChannelAvatarSeed): Promise<CommonChannel | undefined> => {
  const [channel] = await resolveCommonChannels(PEER, [row], () => Promise.resolve([PEER, '0xB']), seedOf);
  return channel;
};

describe('a shared channel', () => {
  test('fills the fields a row leaves out', async () => {
    expect(await shared({ convId: 'c1' })).toEqual({
      convId: 'c1',
      title: 'Channel',
      placeholderTitle: true,
      avatarUri: null,
      avatarAddress: null,
      memberCount: 3,
      lastTs: null,
      lastPreview: '',
      lastSenderAddress: null,
      lastFromSelf: false,
      unreadCount: 0,
      markedUnread: false,
    });
  });

  test('uses avatarAddress only when no avatarUri', async () => {
    expect(await shared({ convId: 'c1', avatarUri: 'ipfs://x', avatarAddress: '0xSeed' })).toMatchObject({
      avatarUri: 'ipfs://x',
      avatarAddress: null,
    });
    expect((await shared({ convId: 'c1', avatarAddress: '0xSeed' }))?.avatarAddress).toBe('0xSeed');
  });

  test('flags a fallback title, never a real name', async () => {
    expect((await shared({ convId: 'c1', title: '3 members', groupName: '' }))?.placeholderTitle).toBe(true);
    expect((await shared({ convId: 'c1', title: 'Team', groupName: 'Team' }))?.placeholderTitle).toBe(false);
  });

  test('an avatar seed from the app replaces avatarAddress when there is no avatarUri', async () => {
    const seedOf = (r: CommonChannelRow): string => `seed:${r.convId}`;
    expect((await shared({ convId: 'c1', avatarAddress: '0xSeed' }, seedOf))?.avatarAddress).toBe('seed:c1');
    expect((await shared({ convId: 'c1', avatarUri: 'ipfs://x', avatarAddress: '0xSeed' }, seedOf))?.avatarAddress).toBeNull();
  });
});

describe('resolveCommonChannels', () => {
  const rows: CommonChannelRow[] = [
    { convId: 'g1', peerAddress: null, title: 'Alpha' },
    { convId: 'g2', peerAddress: null, title: 'Beta' },
    { convId: 'dm', peerAddress: '0xSomeone', title: 'DM' },
  ];

  const members: Record<string, string[]> = { g1: ['0xpeeraddress', '0xother'], g2: ['0xnobody'] };

  test('keeps groups containing the peer, excludes DMs', async () => {
    const result = await resolveCommonChannels(PEER, rows, (convId) => Promise.resolve(members[convId] ?? []));
    expect(result.map((c) => c.convId)).toEqual(['g1']);
  });

  test('case-insensitive peer match', async () => {
    const result = await resolveCommonChannels('0XPEERADDRESS', [{ convId: 'g1', peerAddress: null }], () =>
      Promise.resolve(['0xPeerAddress']),
    );
    expect(result).toHaveLength(1);
  });

  test('swallows member resolution errors', async () => {
    const result = await resolveCommonChannels(PEER, [{ convId: 'g1', peerAddress: null }], () => Promise.reject(new Error('boom')));
    expect(result).toEqual([]);
  });
});
