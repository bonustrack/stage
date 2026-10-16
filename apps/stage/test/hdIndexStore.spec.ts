import { describe, expect, test } from 'bun:test';
import { makeHdIndexStore } from '../lib/zerodev/hdIndexStore.core';

describe('wallet index reservation', () => {
  for (const raw of ['invalid', '', '-1', '1.5', '9007199254740992']) {
    test(`invalid stored index ${JSON.stringify(raw)} blocks writes`, async () => {
      const writes: string[] = [];
      const store = makeHdIndexStore({ get: () => Promise.resolve(raw), set: (_key, value) => { writes.push(value); return Promise.resolve(undefined); } });
      await expect(store.reserve('synthetic', 1)).rejects.toThrow('saved wallet index is invalid');
      expect(writes).toEqual([]);
    });
  }
  test('overlapping and lower reservations never lower the high-water index', async () => {
    let saved: string | null = '0';
    const gate = Promise.withResolvers<undefined>();
    const store = makeHdIndexStore({
      get: () => Promise.resolve(saved),
      set: async (_key, value) => { if (value === '2') await gate.promise; saved = value; },
    });
    const low = store.reserve('synthetic', 1);
    const high = store.reserve('synthetic', 8);
    gate.resolve(undefined);
    await Promise.all([low, high]);
    await store.reserve('synthetic', 0);
    expect(saved).toBe('9');
  });
  test('a storage failure is visible and does not poison later explicit reservation', async () => {
    let failed = true;
    let saved: string | null = null;
    const store = makeHdIndexStore({
      get: () => failed ? Promise.reject(new Error('storage unavailable')) : Promise.resolve(saved),
      set: (_key, value) => { saved = value; return Promise.resolve(undefined); },
    });
    await expect(store.reserve('synthetic', 0)).rejects.toThrow('storage unavailable');
    expect(saved).toBeNull();
    failed = false;
    await store.reserve('synthetic', 0);
    expect(saved).toBe('1');
  });
});
