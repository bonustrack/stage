import { beforeEach, describe, expect, mock, test } from 'bun:test';

const values = new Map<string, string>();
let activeId: string | null = 'alice';
let failRead = false;
const writes: string[] = [];
const storage = {
  get: async (key: string): Promise<string | null> => {
    if (failRead) throw new Error('storage unavailable');
    return values.get(key) ?? null;
  },
  set: async (key: string, value: string): Promise<void> => {
    writes.push(key);
    values.set(key, value);
  },
};

mock.module('../platform/storage', () => ({ appStorage: storage, secureStorage: {} }));
mock.module('../lib/accounts', () => ({ getActiveAccount: async () => activeId === null ? null : { id: activeId } }));
const { createValueStore } = await import('../lib/persistedStore');

beforeEach(() => {
  values.clear();
  writes.length = 0;
  activeId = 'alice';
  failRead = false;
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
    await store.update(n => n + 1);
    expect(store.get()).toBe(5);
    expect(values.get('counter.alice')).toBe('5');
  });

  test('composes concurrent updates against the latest value', async () => {
    const store = accountStore();
    await Promise.all([store.update(n => n + 1), store.update(n => n + 1)]);
    expect(store.get()).toBe(2);
    expect(values.get('counter.alice')).toBe('2');
  });

  test('loads each account without changing the previous account', async () => {
    values.set('counter.alice', '4');
    values.set('counter.bob', '8');
    const store = accountStore();
    await store.load();
    activeId = 'bob';
    await store.update(n => n + 1);
    expect(store.get()).toBe(9);
    expect(values.get('counter.alice')).toBe('4');
    expect(values.get('counter.bob')).toBe('9');
  });

  test('rejects failed account reads without mutating or persisting stale data', async () => {
    values.set('counter.alice', '4');
    const store = accountStore();
    await store.load();
    activeId = 'bob';
    failRead = true;
    await expect(store.update(n => n + 1)).rejects.toThrow('storage unavailable');
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
    await store.update(n => n + 1, 'bob');
    await store.update(n => n + 10, 'alice');
    expect(store.get()).toBe(14);
    expect(values.has('counter.bob')).toBe(false);
  });

  test('does not persist without an account or when an update is unchanged', async () => {
    const store = accountStore();
    await store.update(n => n);
    activeId = null;
    await store.update(n => n + 1);
    expect(store.get()).toBe(1);
    expect(writes).toEqual([]);
  });

  test('reads and writes another account without touching the active one', async () => {
    values.set('counter.alice', '4');
    values.set('counter.bob', '8');
    const store = accountStore();
    expect(await store.loadFor('bob')).toBe(8);
    expect(await store.loadFor('carol')).toBe(0);
    await store.updateFor('bob', n => n + 1);
    await store.updateFor('alice', n => n + 10);
    await store.updateFor('carol', n => n);
    expect(store.get()).toBe(14);
    expect(values.get('counter.bob')).toBe('9');
    expect(values.has('counter.carol')).toBe(false);
  });

  test('restore merges a value set before the first load, later accounts start from the default', async () => {
    values.set('counter.alice', '4');
    values.set('counter.bob', '8');
    const store = createValueStore({
      key: 'counter.', default: 1, deserialize: Number, perAccount: true, restore: (local: number, stored: number) => local * stored,
    });
    store.set(3);
    expect(await store.load()).toBe(12);
    activeId = 'bob';
    await store.update(n => n);
    expect(store.get()).toBe(8);
  });
});
