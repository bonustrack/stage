import { describe, expect, test } from 'bun:test';
import { makeReadStateStore, type StoredRead } from '../lib/readStateStore.core';

interface HarnessOptions {
  file?: string | null;
  legacy?: Record<string, StoredRead | null>;
  failedLoads?: number;
}

function harness(opts: HarnessOptions = {}) {
  let raw = opts.file ?? null;
  let failedLoads = opts.failedLoads ?? 0;
  const saves: string[] = [];
  const legacyCalls: string[] = [];
  const clock = { now: 1_000 };
  const store = makeReadStateStore({
    load: () => {
      if (failedLoads > 0) {
        failedLoads -= 1;
        return Promise.reject(new Error('storage unavailable'));
      }
      return Promise.resolve(raw);
    },
    save: (next) => { saves.push(next); raw = next; },
    legacyRead: (convId) => {
      legacyCalls.push(convId);
      return Promise.resolve(opts.legacy?.[convId] ?? null);
    },
    now: () => clock.now,
  });
  const saved = (): unknown => JSON.parse(saves.at(-1) ?? 'null');
  return { store, saves, legacyCalls, clock, saved };
}

const OLD: StoredRead = { lastReadNs: 5, markedUnread: true, at: 1 };

describe('read state store, first run after an upgrade', () => {
  test('falls back to the old per-chat keys once and keeps the answer in the file', async () => {
    const h = harness({ legacy: { a: OLD } });
    h.store.prime(true);
    const [first, second] = await Promise.all([h.store.get('a'), h.store.get('a')]);
    expect(first).toEqual(OLD);
    expect(second).toEqual(OLD);
    expect(await h.store.get('a')).toEqual(OLD);
    expect(h.legacyCalls).toEqual(['a']);
    expect(h.saved()).toEqual({ legacy: true, reads: { a: OLD } });
  });

  test('treats a store read before the account list as an upgrade', async () => {
    const h = harness({ legacy: { a: OLD } });
    expect(await h.store.get('a')).toEqual(OLD);
    expect(h.legacyCalls).toEqual(['a']);
  });

  test('does not record a missing old value, so the next read asks again', async () => {
    const h = harness({ legacy: { a: null } });
    expect(await h.store.get('a')).toBeNull();
    expect(await h.store.get('a')).toBeNull();
    expect(h.legacyCalls).toEqual(['a', 'a']);
  });

  test('rewrites a corrupt file at once and still consults the old keys', async () => {
    const h = harness({ file: 'garbage', legacy: { a: OLD } });
    h.store.prime(false);
    expect(await h.store.get('b')).toBeNull();
    expect(h.saved()).toEqual({ legacy: true, reads: {} });
    expect(await h.store.get('a')).toEqual(OLD);
  });
});

describe('read state store, fresh install', () => {
  test('never reads the old per-chat keys', async () => {
    const h = harness({ legacy: { a: OLD } });
    h.store.prime(false);
    h.store.prime(true);
    expect(await h.store.get('a')).toBeNull();
    expect(h.legacyCalls).toEqual([]);
    expect(h.saved()).toEqual({ legacy: false, reads: {} });
  });

  test('uses a stored file as is', async () => {
    const reads = { a: { lastReadNs: 9, markedUnread: false, at: 3 } };
    const h = harness({ file: JSON.stringify({ legacy: false, reads }), legacy: { b: OLD } });
    expect(await h.store.get('a')).toEqual(reads.a);
    expect(await h.store.get('b')).toBeNull();
    expect(h.legacyCalls).toEqual([]);
    expect(h.saves).toEqual([]);
    expect(await h.store.entries()).toEqual([['a', reads.a]]);
  });
});

describe('read state store, local changes', () => {
  test('stamps every change later than the one it replaces', async () => {
    const h = harness();
    h.store.prime(false);
    expect(await h.store.markRead('a')).toEqual({ lastReadNs: 1_000_000_000, markedUnread: false, at: 1_000 });
    expect(await h.store.markUnread('a')).toEqual({ lastReadNs: 1_000_000_000, markedUnread: true, at: 1_001 });
    await h.store.applyRemote([{ convId: 'a', lastReadNs: 7, markedUnread: false, at: 5_000 }]);
    expect((await h.store.markUnread('a')).at).toBe(5_001);
    expect(h.saved()).toEqual({ legacy: false, reads: { a: { lastReadNs: 7, markedUnread: true, at: 5_001 } } });
  });
});

describe('read state store, remote changes', () => {
  test('applies only newer states and saves once per batch', async () => {
    const h = harness({ file: JSON.stringify({ legacy: false, reads: { a: { lastReadNs: 1, markedUnread: false, at: 10 } } }) });
    const applied = await h.store.applyRemote([
      { convId: 'a', lastReadNs: 2, markedUnread: false, at: 5 },
      { convId: 'b', lastReadNs: 3, markedUnread: true, at: 3 },
      { convId: 'a', lastReadNs: 4, markedUnread: false, at: 20 },
    ]);
    expect(applied.map((s) => `${s.convId}@${String(s.at)}`)).toEqual(['b@3', 'a@20']);
    expect(h.saves).toHaveLength(1);
    expect(await h.store.get('a')).toEqual({ lastReadNs: 4, markedUnread: false, at: 20 });
    expect(await h.store.applyRemote([{ convId: 'a', lastReadNs: 9, markedUnread: false, at: 20 }])).toEqual([]);
    expect(h.saves).toHaveLength(1);
  });
});

describe('read state store, storage failure', () => {
  test('a failed load throws instead of reading as empty, and the next call retries', async () => {
    const h = harness({ file: JSON.stringify({ legacy: false, reads: { a: OLD } }), failedLoads: 1 });
    let failure: unknown = null;
    await h.store.get('a').catch((err: unknown) => { failure = err; });
    expect(failure).toBeInstanceOf(Error);
    expect(h.saves).toEqual([]);
    expect(await h.store.get('a')).toEqual(OLD);
  });
});
