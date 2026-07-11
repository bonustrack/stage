
import { describe, expect, test } from 'bun:test';
import {
  addressesWithQueued,
  deserializeOutbox,
  itemsForAddress,
  pendingBanner,
  withoutItem,
  type OutboxItem,
} from '../lib/dmOutbox.model';

const item = (over: Partial<OutboxItem> & { id: string }): OutboxItem => ({
  address: '0xabc',
  text: 'hey',
  createdAt: 1,
  ...over,
});

describe('deserializeOutbox — storage boundary is guarded', () => {
  test('round-trips a valid queue', () => {
    const items = [item({ id: 'a' }), item({ id: 'b', createdAt: 2 })];
    expect(deserializeOutbox(JSON.stringify(items))).toEqual(items);
  });
  test('rejects corrupt payloads instead of crashing', () => {
    expect(deserializeOutbox('not-json')).toBeUndefined();
    expect(deserializeOutbox('{"a":1}')).toBeUndefined();
    expect(deserializeOutbox('[{"id":1}]')).toBeUndefined();
    expect(deserializeOutbox('[null]')).toBeUndefined();
  });
});

describe('queue operations', () => {
  const items = [
    item({ id: 'c', address: '0xabc', createdAt: 3 }),
    item({ id: 'a', address: '0xabc', createdAt: 1 }),
    item({ id: 'x', address: '0xdef', createdAt: 2 }),
  ];
  test('itemsForAddress filters by address and orders by createdAt', () => {
    expect(itemsForAddress(items, '0xABC').map(i => i.id)).toEqual(['a', 'c']);
  });
  test('addressesWithQueued lists unique addresses', () => {
    expect(addressesWithQueued(items).slice().sort()).toEqual(['0xabc', '0xdef']);
  });
  test('withoutItem removes exactly one item', () => {
    expect(withoutItem(items, 'a').map(i => i.id)).toEqual(['c', 'x']);
  });
});

describe('pendingBanner — truthful copy per reason', () => {
  test('unregistered peers are told delivery happens when they join', () => {
    expect(pendingBanner('unregistered', '0xef83…43e7')).toContain("isn't on XMTP yet");
    expect(pendingBanner('unregistered', '0xef83…43e7')).toContain('delivered when they join');
  });
  test('stale peers are told delivery happens when they open an XMTP app', () => {
    expect(pendingBanner('stale-installations', '0xef83…43e7')).toContain('keys have expired');
    expect(pendingBanner('stale-installations', '0xef83…43e7')).toContain('open an XMTP app');
  });
});
