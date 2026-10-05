import { expect, mock, test } from 'bun:test';

const values = new Map<string, string>();
const cached = new Map<string, unknown>();
mock.module('../platform/storage', () => ({ appStorage: { get: async (key: string) => values.get(key) ?? null }, secureStorage: {} }));
mock.module('../lib/cache', () => ({
  persistenceBackend: {
    read: async (key: string) => cached.get(key) ?? null,
    write: (key: string, value: unknown) => { cached.set(key, value); },
    onFlushSignal: () => undefined,
  },
}));
const { PersistentStore } = await import('../lib/cache.shared');
const { visibleCachedRows } = await import('../lib/hiddenChannelsStorage');

test('cache hydration never publishes a durable hidden channel', async () => {
  const rows = [{ convId: 'hidden', peerAddress: null }, { convId: 'shown', peerAddress: null }];
  cached.set('rows', rows);
  values.set('channels.hidden.a', JSON.stringify({ hidden: { hidden: true, at: 1 } }));
  const store = new PersistentStore('rows', undefined, (stored: typeof rows) => visibleCachedRows('a', stored));
  const published: unknown[] = [];
  store.subscribe(value => { published.push(value); });
  expect(await store.hydrate()).toEqual([rows[1]]);
  expect(published).toEqual([[rows[1]]]);
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
