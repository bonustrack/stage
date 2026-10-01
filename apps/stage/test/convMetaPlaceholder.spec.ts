import { describe, expect, test } from 'bun:test';
import { convMetaFromCachedRow } from '../modules/messaging/convMeta.model';
import type { ConvMeta } from '../modules/messaging/convMeta.fetch';

const EMPTY: ConvMeta = {
  peerAddr: null, isGroup: false, groupName: null, groupImage: '', groupDescription: '', memberAddrs: [], assigned: [], assignedReady: false, inboxToAddr: {},
};

describe('convMetaFromCachedRow', () => {
  test('a cached direct chat row gives the peer right away', () => {
    const rows = [{ convId: 'c1', peerAddress: '0xabc', inboxToAddr: { i1: '0xabc', bad: 3 } }];
    expect(convMetaFromCachedRow(rows, 'c1', EMPTY)).toEqual({ ...EMPTY, peerAddr: '0xabc', inboxToAddr: { i1: '0xabc' } });
  });

  test('a cached channel row gives its name, image and other members right away', () => {
    const rows = [{
      convId: 'g', peerAddress: null, groupName: 'Team', avatarUri: 'https://x/a.png', selfInboxId: 'me',
      inboxToAddr: { me: '0xme', i1: '0xa', i2: '0xb' },
    }];
    expect(convMetaFromCachedRow(rows, 'g', EMPTY)).toEqual({
      ...EMPTY, isGroup: true, groupName: 'Team', groupImage: 'https://x/a.png',
      memberAddrs: ['0xa', '0xb'], inboxToAddr: { me: '0xme', i1: '0xa', i2: '0xb' },
    });
  });

  test('a channel row without a name or image keeps the empty values', () => {
    expect(convMetaFromCachedRow([{ convId: 'g', peerAddress: null, avatarUri: null }], 'g', EMPTY))
      .toEqual({ ...EMPTY, isGroup: true });
  });

  test('no placeholder for unresolved peers or unknown chats', () => {
    expect(convMetaFromCachedRow([{ convId: 'd', peerAddress: '' }], 'd', EMPTY)).toBeUndefined();
    expect(convMetaFromCachedRow([{ convId: 'u' }], 'u', EMPTY)).toBeUndefined();
    expect(convMetaFromCachedRow([], 'x', EMPTY)).toBeUndefined();
    expect(convMetaFromCachedRow(null, 'x', EMPTY)).toBeUndefined();
  });
});
