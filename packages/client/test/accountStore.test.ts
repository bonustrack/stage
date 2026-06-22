import { describe, expect, test } from 'bun:test';
import { createAccountStore, type KeyValueStore } from '../src/accounts/store';

function memoryKv(): KeyValueStore {
  const map = new Map<string, string>();
  return {
    get: (key) => map.get(key) ?? null,
    set: (key, value) => { map.set(key, value); },
    remove: (key) => { map.delete(key); },
  };
}

describe('createAccountStore', () => {
  test('starts empty', async () => {
    const store = createAccountStore(memoryKv());
    expect(await store.loadAccounts()).toEqual([]);
    expect(await store.getActiveAccount()).toBeNull();
    expect(await store.getActiveAccountId()).toBeNull();
  });

  test('adds local accounts and persists', async () => {
    const store = createAccountStore(memoryKv());
    const rec = await store.addLocalAccount('a1', '0xAAA', 'generated');
    expect(rec.id).toBe('a1');
    expect(rec.type).toBe('generated');
    const list = await store.loadAccounts();
    expect(list).toHaveLength(1);
  });

  test('falls back to first account when no active set', async () => {
    const store = createAccountStore(memoryKv());
    await store.addLocalAccount('a1', '0xAAA', 'generated');
    await store.addLocalAccount('a2', '0xBBB', 'privateKey');
    const active = await store.getActiveAccount();
    expect(active?.id).toBe('a1');
  });

  test('respects explicit active id', async () => {
    const store = createAccountStore(memoryKv());
    await store.addLocalAccount('a1', '0xAAA', 'generated');
    await store.addLocalAccount('a2', '0xBBB', 'privateKey');
    await store.setActiveAccountId('a2');
    expect((await store.getActiveAccount())?.id).toBe('a2');
  });

  test('removing active reassigns to a remaining account', async () => {
    const store = createAccountStore(memoryKv());
    await store.addLocalAccount('a1', '0xAAA', 'generated');
    await store.addLocalAccount('a2', '0xBBB', 'privateKey');
    await store.setActiveAccountId('a2');
    const next = await store.removeAccount('a2');
    expect(next.map(a => a.id)).toEqual(['a1']);
    expect(await store.getActiveAccountId()).toBe('a1');
  });

  test('removing last account clears active', async () => {
    const store = createAccountStore(memoryKv());
    await store.addLocalAccount('a1', '0xAAA', 'generated');
    await store.setActiveAccountId('a1');
    await store.removeAccount('a1');
    expect(await store.loadAccounts()).toEqual([]);
    expect(await store.getActiveAccountId()).toBeNull();
  });

  test('removing non-active leaves active untouched', async () => {
    const store = createAccountStore(memoryKv());
    await store.addLocalAccount('a1', '0xAAA', 'generated');
    await store.addLocalAccount('a2', '0xBBB', 'privateKey');
    await store.setActiveAccountId('a1');
    await store.removeAccount('a2');
    expect(await store.getActiveAccountId()).toBe('a1');
  });

  test('honours custom keys', async () => {
    const kv = memoryKv();
    const store = createAccountStore(kv, { list: 'x.list', active: 'x.active' });
    await store.addLocalAccount('a1', '0xAAA', 'generated');
    expect(await kv.get('x.list')).toBeTruthy();
  });
});
