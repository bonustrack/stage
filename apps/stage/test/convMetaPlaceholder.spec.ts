import { describe, expect, test } from 'bun:test';
import { convMetaFromCachedRow } from '../modules/messaging/convMeta.model';
import type { ConvMeta } from '../modules/messaging/convMeta.fetch';

const EMPTY: ConvMeta = {
  peerAddr: null, isGroup: false, groupName: null, groupImage: '', groupDescription: '', memberAddrs: [], inboxToAddr: {},
};

describe('convMetaFromCachedRow', () => {
  test('a cached direct chat row gives the peer right away', () => {
    const rows = [{ convId: 'c1', peerAddress: '0xabc', inboxToAddr: { i1: '0xabc', bad: 3 } }];
    expect(convMetaFromCachedRow(rows, 'c1', EMPTY)).toEqual({ ...EMPTY, peerAddr: '0xabc', inboxToAddr: { i1: '0xabc' } });
  });

  test('no placeholder for groups, unresolved peers or unknown chats', () => {
    expect(convMetaFromCachedRow([{ convId: 'g', peerAddress: null }], 'g', EMPTY)).toBeUndefined();
    expect(convMetaFromCachedRow([{ convId: 'd', peerAddress: '' }], 'd', EMPTY)).toBeUndefined();
    expect(convMetaFromCachedRow([], 'x', EMPTY)).toBeUndefined();
    expect(convMetaFromCachedRow(null, 'x', EMPTY)).toBeUndefined();
  });
});
