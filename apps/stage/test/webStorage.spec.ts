import { afterAll, expect, test } from 'bun:test';

const items = new Map<string, string>();
let full = false;
const scope = globalThis as { localStorage?: unknown };
const previous = scope.localStorage;
scope.localStorage = {
  getItem: (key: string) => items.get(key) ?? null,
  setItem: (key: string, value: string) => {
    if (full) throw new Error('QuotaExceededError');
    items.set(key, value);
  },
  removeItem: (key: string) => {
    items.delete(key);
  },
};
afterAll(() => {
  scope.localStorage = previous;
});

const { appStorage, secureStorage } = await import('../platform/storage.web');

test('a full web storage rejects the write instead of throwing', async () => {
  await appStorage.set('a', '1');
  expect(await appStorage.get('a')).toBe('1');
  full = true;
  let thrown: unknown = null;
  let write: Promise<void> | null = null;
  try {
    write = appStorage.set('b', '2');
  } catch (err) {
    thrown = err;
  }
  expect(thrown).toBeNull();
  await expect(write ?? Promise.resolve()).rejects.toThrow('QuotaExceededError');
  await expect(secureStorage.set('c', '3')).rejects.toThrow('QuotaExceededError');
  full = false;
  expect(await appStorage.get('b')).toBeNull();
});
