import { expect, mock, test } from 'bun:test';
import { row } from './rowFixture';

const values = new Map<string, string>();
const cached = new Map<string, unknown>();
mock.module('../platform/storage', () => ({ appStorage: { get: async (key: string) => values.get(key) ?? null }, secureStorage: {} }));
mock.module('../lib/cache', () => ({
  persistenceBackend: {
    read: async (key: string) => cached.get(key) ?? null,
    write: (key: string, value: unknown) => {
      cached.set(key, value);
    },
    onFlushSignal: () => undefined,
  },
}));
const { PersistentStore } = await import('../lib/cache.shared');
const { visibleCachedRows } = await import('../lib/sync/hiddenChannels');
const { getCachedRows, hydrateCachedRows, setCachedRows } = await import('../lib/channelsCache');
const { rememberActiveAccountId } = await import('../lib/accountSelection');
const { filterChannelRows } = await import('@stage-labs/client/xmtp/channelsFilter');

test('cache hydration never publishes a durable hidden channel, and a direct chat is never hidden', async () => {
  const shown = { convId: 'shown', peerAddress: null };
  const dm = { convId: 'dm', peerAddress: '0xpeer' };
  const rows = [{ convId: 'hidden', peerAddress: null }, shown, dm];
  cached.set('rows', rows);
  values.set('channels.hidden.a', JSON.stringify({ hidden: { hidden: true, at: 1 }, dm: { hidden: true, at: 1 } }));
  const store = new PersistentStore<{ convId: string; peerAddress: string | null }[]>('rows', undefined, (stored) =>
    visibleCachedRows('a', stored),
  );
  const published: unknown[] = [];
  store.subscribe((value) => {
    published.push(value);
  });
  expect(await store.hydrate()).toEqual([shown, dm]);
  expect(published).toEqual([[shown, dm]]);
});

test('actual channel-cache hydration and writes publish the same safe title used for search', async () => {
  const unnamed = row('unnamed', { title: 'proto', groupName: '', lastTs: null });
  cached.set('channels-cache.title-test.json', [unnamed]);
  rememberActiveAccountId('title-test');
  await hydrateCachedRows();
  expect(getCachedRows()?.[0]?.title).toBe('Untitled channel');
  const hydrated = getCachedRows() ?? [];
  expect(filterChannelRows(hydrated, { query: 'Untitled channel' })).toHaveLength(1);
  expect(filterChannelRows(hydrated, { query: 'proto' })).toHaveLength(0);
  setCachedRows([{ ...unnamed, inboxToAddr: { self: '0xself', other: '0xother' } }]);
  expect(getCachedRows()?.[0]?.title).toBe('2 members');
  const resolved = getCachedRows() ?? [];
  expect(filterChannelRows(resolved, { query: '2 members' })).toHaveLength(1);
  expect(filterChannelRows(resolved, { query: 'proto' })).toHaveLength(0);
  setCachedRows([{ ...unnamed, groupName: 'proto' }]);
  expect(getCachedRows()?.[0]?.title).toBe('proto');
  setCachedRows([{ ...unnamed, title: 'Old title', groupName: 'Edited title' }]);
  expect(getCachedRows()?.[0]?.title).toBe('Edited title');
});

test('a slow hydration filter cannot replace newer live rows', async () => {
  const filter = Promise.withResolvers<string[]>();
  cached.set('slow', ['old']);
  const store = new PersistentStore<string[]>('slow', undefined, () => filter.promise);
  const hydration = store.hydrate();
  await Promise.resolve();
  store.set(['new']);
  filter.resolve(['filtered old']);
  expect(await hydration).toEqual(['new']);
  expect(store.get()).toEqual(['new']);
  store.flushNow();
});
