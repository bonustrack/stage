import { describe, expect, test } from 'bun:test';
import { NO_SYNC_STAMPS, type SyncStamps } from '@stage-labs/client/xmtp/syncSnapshot';
import { makeSyncStampsStore } from '../lib/readSyncStamps.core';

function harness(stored: Record<string, string> = {}) {
  const saves: [string, string][] = [];
  const store = makeSyncStampsStore({
    get: (key) => Promise.resolve(stored[key] ?? null),
    save: (key, raw) => { saves.push([key, raw]); },
  });
  const saved = (): [string, unknown] | null => {
    const last = saves.at(-1);
    return last === undefined ? null : [last[0], JSON.parse(last[1])];
  };
  return { store, saves, saved };
}

const KEY = 'readSync.stamps.acc';
const STORED: SyncStamps = { pin: { convId: 'p', at: 50 }, boardAt: 40 };

describe('sync stamps store, reading', () => {
  test('reads the stamps stored for the account and nothing else', async () => {
    const h = harness({ [KEY]: JSON.stringify(STORED), 'readSync.stamps.other': 'garbage' });
    expect(await h.store.read('acc')).toEqual(STORED);
    expect(await h.store.read('other')).toBeNull();
    expect(await h.store.read('missing')).toBeNull();
  });
});

describe('sync stamps store, before the stored stamps are adopted', () => {
  test('keeps local stamps in memory without saving them', () => {
    const h = harness();
    h.store.stampPin({ convId: 'q', at: 60 });
    h.store.stampBoard(30);
    expect(h.store.current()).toEqual({ pin: { convId: 'q', at: 60 }, boardAt: 30 });
    expect(h.store.loaded()).toBe(false);
    expect(h.store.persisting()).toBe(false);
    expect(h.saves).toEqual([]);
  });
});

describe('sync stamps store, adopting', () => {
  test('keeps the newer of each stamp from storage and memory and saves the result', () => {
    const h = harness();
    h.store.stampPin({ convId: 'q', at: 60 });
    h.store.stampBoard(30);
    h.store.adopt('acc', STORED, true);
    const merged = { pin: { convId: 'q', at: 60 }, boardAt: 40 };
    expect(h.store.current()).toEqual(merged);
    expect(h.store.loaded()).toBe(true);
    expect(h.store.persisting()).toBe(true);
    expect(h.saved()).toEqual([KEY, merged]);
  });

  test('saves every later stamp under the account key', () => {
    const h = harness();
    h.store.adopt('acc', null, true);
    expect(h.saved()).toEqual([KEY, NO_SYNC_STAMPS]);
    h.store.stampBoard(70);
    expect(h.saved()).toEqual([KEY, { pin: null, boardAt: 70 }]);
  });

  test('never saves when the stored stamps could not be read', () => {
    const h = harness();
    h.store.adopt('acc', null, false);
    h.store.stampPin({ convId: 'q', at: 60 });
    h.store.seed(STORED);
    expect(h.store.loaded()).toBe(true);
    expect(h.store.persisting()).toBe(false);
    expect(h.store.current()).toEqual({ pin: { convId: 'q', at: 60 }, boardAt: 40 });
    expect(h.saves).toEqual([]);
  });
});

describe('sync stamps store, seeding from history', () => {
  test('takes only stamps newer than the ones it holds', () => {
    const h = harness();
    h.store.adopt('acc', STORED, true);
    h.store.seed({ pin: { convId: 'old', at: 10 }, boardAt: 90 });
    expect(h.store.current()).toEqual({ pin: { convId: 'p', at: 50 }, boardAt: 90 });
    expect(h.saved()).toEqual([KEY, { pin: { convId: 'p', at: 50 }, boardAt: 90 }]);
  });
});

describe('sync stamps store, clearing', () => {
  test('forgets the stamps and the account until the next adopt', () => {
    const h = harness();
    h.store.adopt('acc', STORED, true);
    const saves = h.saves.length;
    h.store.clear();
    expect(h.store.current()).toEqual(NO_SYNC_STAMPS);
    expect(h.store.loaded()).toBe(false);
    expect(h.store.persisting()).toBe(false);
    h.store.stampBoard(99);
    expect(h.saves).toHaveLength(saves);
  });
});
