import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { selectAccount } from './activeAccount';

const values = new Map<string, string>();
selectAccount('alice');
let failRead = false;
let readGate: Promise<unknown> = Promise.resolve();
const writes: string[] = [];
const reads: string[] = [];
const storage = {
  get: async (key: string): Promise<string | null> => {
    reads.push(key);
    if (failRead) throw new Error('storage unavailable');
    await readGate;
    return values.get(key) ?? null;
  },
  set: async (key: string, value: string): Promise<void> => {
    writes.push(key);
    values.set(key, value);
  },
};

mock.module('../platform/storage', () => ({ appStorage: storage, secureStorage: {} }));
const { createValueStore } = await import('../lib/persistedStore');
const { storedStrings } = await import('../lib/storeCore');
const { accountSelectionChanged } = await import('../lib/accountSelection');

beforeEach(() => {
  values.clear();
  writes.length = 0;
  selectAccount('alice');
  failRead = false;
  readGate = Promise.resolve();
});

function accountStore(): ReturnType<typeof createValueStore<number>> {
  return createValueStore({ key: 'counter.', default: 0, deserialize: Number, perAccount: true });
}

describe('persisted value stores', () => {
  test('keeps the unscoped key and hydrates only once', async () => {
    values.set('counter', '4');
    const store = createValueStore({ key: 'counter', default: 0, deserialize: Number });
    expect(await store.load()).toBe(4);
    values.set('counter', '7');
    expect(await store.load()).toBe(4);
    await store.setAsync(5);
    expect(values.get('counter')).toBe('5');
    expect(writes).toEqual(['counter']);
  });

  test('keeps the existing per-account key and loads before updating', async () => {
    values.set('counter.alice', '4');
    const store = accountStore();
    await store.update((n) => n + 1);
    expect(store.get()).toBe(5);
    expect(values.get('counter.alice')).toBe('5');
  });

  test('composes concurrent updates against the latest value', async () => {
    const store = accountStore();
    await Promise.all([store.update((n) => n + 1), store.update((n) => n + 1)]);
    expect(store.get()).toBe(2);
    expect(values.get('counter.alice')).toBe('2');
  });

  test('loads each account without changing the previous account', async () => {
    values.set('counter.alice', '4');
    values.set('counter.bob', '8');
    const store = accountStore();
    await store.load();
    selectAccount('bob');
    await store.update((n) => n + 1);
    expect(store.get()).toBe(9);
    expect(values.get('counter.alice')).toBe('4');
    expect(values.get('counter.bob')).toBe('9');
  });

  test('rejects failed account reads without mutating or persisting stale data', async () => {
    values.set('counter.alice', '4');
    const store = accountStore();
    await store.load();
    selectAccount('bob');
    failRead = true;
    await expect(store.update((n) => n + 1)).rejects.toThrow('storage unavailable');
    expect(store.get()).toBe(4);
    expect(writes).toEqual([]);
    expect(values.get('counter.alice')).toBe('4');
  });

  test('can retry a failed initial account load', async () => {
    values.set('counter.alice', '4');
    const store = accountStore();
    failRead = true;
    await expect(store.load()).rejects.toThrow('storage unavailable');
    failRead = false;
    expect(await store.load()).toBe(4);
  });

  test('drops an update meant for another account', async () => {
    values.set('counter.alice', '4');
    const store = accountStore();
    expect(store.accountId()).toBeNull();
    await store.load();
    expect(store.accountId()).toBe('alice');
    await store.update((n) => n + 1, 'bob');
    await store.update((n) => n + 10, 'alice');
    expect(store.get()).toBe(14);
    expect(values.has('counter.bob')).toBe(false);
  });

  test('does not persist without an account or when an update is unchanged', async () => {
    const store = accountStore();
    await store.update((n) => n);
    selectAccount(null);
    await store.update((n) => n + 1);
    expect(store.get()).toBe(1);
    expect(writes).toEqual([]);
  });

  test('reads and writes another account without touching the active one', async () => {
    values.set('counter.alice', '4');
    values.set('counter.bob', '8');
    const store = accountStore();
    expect(await store.loadFor('bob')).toBe(8);
    expect(await store.loadFor('carol')).toBe(0);
    await store.updateFor('bob', (n) => n + 1);
    await store.updateFor('alice', (n) => n + 10);
    await store.updateFor('carol', (n) => n);
    expect(store.get()).toBe(14);
    expect(values.get('counter.bob')).toBe('9');
    expect(values.has('counter.carol')).toBe(false);
  });

  test('a schema store keeps the strings of a list, writes JSON and ignores unreadable JSON', async () => {
    values.set('list.alice', '["a",1,"b",null]');
    const store = createValueStore<readonly string[]>({ key: 'list.', default: [], schema: storedStrings, perAccount: true });
    expect(await store.load()).toEqual(['a', 'b']);
    await store.update((list) => [...list, 'c']);
    expect(values.get('list.alice')).toBe('["a","b","c"]');
    selectAccount('bob');
    values.set('list.bob', '{');
    await store.update((list) => list);
    expect(store.get()).toEqual([]);
  });

  test('readNow takes the saved value at creation from a storage that reads synchronously', async () => {
    values.set('pane', '7');
    const store = createValueStore({
      key: 'pane',
      default: 1,
      readNow: true,
      deserialize: Number,
      storage: { ...storage, getSync: (key) => values.get(key) ?? null },
    });
    expect(store.get()).toBe(7);
    values.set('pane', '9');
    expect(await store.load()).toBe(7);
    const later = createValueStore({ key: 'pane', default: 1, readNow: true, deserialize: Number });
    expect(later.get()).toBe(1);
    expect(await later.load()).toBe(9);
  });

  test('restore merges a value set before the first load, later accounts start from the default', async () => {
    values.set('counter.alice', '4');
    values.set('counter.bob', '8');
    const store = createValueStore({
      key: 'counter.',
      default: 1,
      deserialize: Number,
      perAccount: true,
      restore: (local: number, stored: number) => local * stored,
    });
    store.set(3);
    expect(await store.load()).toBe(12);
    selectAccount('bob');
    await store.update((n) => n);
    expect(store.get()).toBe(8);
  });

  test('a read that the account selection outruns loads the newly selected account', async () => {
    values.set('counter.alice', '4');
    values.set('counter.bob', '8');
    const gate = Promise.withResolvers<undefined>();
    readGate = gate.promise;
    const store = accountStore();
    reads.length = 0;
    const loading = store.load();
    await Promise.resolve();
    await Promise.resolve();
    expect(reads).toEqual(['counter.alice']);
    selectAccount('bob');
    accountSelectionChanged();
    gate.resolve(undefined);
    expect(await loading).toBe(8);
    expect(store.accountId()).toBe('bob');
    expect(reads).toEqual(['counter.alice', 'counter.bob']);
  });
});
