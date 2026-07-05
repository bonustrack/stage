import { describe, expect, test } from 'bun:test';
import {
  commonChannelFromRow,
  resolveCommonChannels,
  type CommonChannelRow,
} from '../src/xmtp/commonChannels';

const PEER = '0xPeerAddress';

describe('commonChannelFromRow', () => {
  test('maps fields with defaults', () => {
    const row: CommonChannelRow = { convId: 'c1' };
    const ch = commonChannelFromRow(row, ['0xA', '0xB']);
    expect(ch.convId).toBe('c1');
    expect(ch.title).toBe('Group');
    expect(ch.avatarUri).toBeNull();
    expect(ch.memberCount).toBe(3);
    expect(ch.lastPreview).toBe('');
    expect(ch.lastFromSelf).toBe(false);
  });

  test('uses avatarAddress only when no avatarUri', () => {
    const withUri = commonChannelFromRow(
      { convId: 'c1', avatarUri: 'ipfs://x', avatarAddress: '0xSeed' }, []);
    expect(withUri.avatarUri).toBe('ipfs://x');
    expect(withUri.avatarAddress).toBeNull();
    const withSeed = commonChannelFromRow(
      { convId: 'c1', avatarAddress: '0xSeed' }, []);
    expect(withSeed.avatarAddress).toBe('0xSeed');
  });

  test('injected avatarSeedOf overrides avatarAddress when no avatarUri (app parity)', () => {
    const seedOf = (r: CommonChannelRow): string => `seed:${r.convId}`;
    const withSeed = commonChannelFromRow({ convId: 'c1', avatarAddress: '0xSeed' }, [], seedOf);
    expect(withSeed.avatarAddress).toBe('seed:c1');
    const withUri = commonChannelFromRow(
      { convId: 'c1', avatarUri: 'ipfs://x', avatarAddress: '0xSeed' }, [], seedOf);
    expect(withUri.avatarAddress).toBeNull();
  });
});

describe('resolveCommonChannels', () => {
  const rows: CommonChannelRow[] = [
    { convId: 'g1', peerAddress: null, title: 'Alpha' },
    { convId: 'g2', peerAddress: null, title: 'Beta' },
    { convId: 'dm', peerAddress: '0xSomeone', title: 'DM' },
    { convId: 'g3', peerAddress: null, title: 'Archived' },
  ];

  const members: Record<string, string[]> = {
    g1: ['0xpeeraddress', '0xother'],
    g2: ['0xnobody'],
    g3: ['0xpeeraddress'],
  };

  test('keeps groups containing the peer, excludes DMs and archived', async () => {
    const result = await resolveCommonChannels(
      PEER,
      rows,
      (convId) => Promise.resolve(members[convId] ?? []),
      new Set(['g3']),
    );
    expect(result.map(c => c.convId)).toEqual(['g1']);
  });

  test('case-insensitive peer match', async () => {
    const result = await resolveCommonChannels(
      '0XPEERADDRESS',
      [{ convId: 'g1', peerAddress: null }],
      () => Promise.resolve(['0xPeerAddress']),
      new Set(),
    );
    expect(result).toHaveLength(1);
  });

  test('swallows member resolution errors', async () => {
    const result = await resolveCommonChannels(
      PEER,
      [{ convId: 'g1', peerAddress: null }],
      () => Promise.reject(new Error('boom')),
      new Set(),
    );
    expect(result).toEqual([]);
  });
});
