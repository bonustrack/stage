import { describe, expect, test } from 'bun:test';
import {
  freshestPerAccount,
  memoryTokenStore,
  removeToken,
  targetsForAccount,
  upsertToken,
  type StoredPushToken,
} from '../src/tokens.ts';

describe('upsertToken', () => {
  test('dedupes by token and merges inbox ids', () => {
    const store = memoryTokenStore();
    upsertToken(store, { token: 'a'.repeat(30), account: 'bridge', inboxId: 'inbox-1' });
    const total = upsertToken(store, { token: 'a'.repeat(30), account: 'bridge', inboxId: 'inbox-2' });
    expect(total).toBe(1);
    const rows = store.load();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.inboxIds?.sort()).toEqual(['inbox-1', 'inbox-2']);
  });

  test('keeps registeredAt across upserts', () => {
    const store = memoryTokenStore();
    upsertToken(store, { token: 'b'.repeat(30) });
    const first = store.load()[0]?.registeredAt;
    upsertToken(store, { token: 'b'.repeat(30) });
    expect(store.load()[0]?.registeredAt).toBe(first);
  });
});

describe('removeToken', () => {
  test('returns -1 when absent, count when removed', () => {
    const store = memoryTokenStore([{ token: 'x'.repeat(30), registeredAt: 'now' }]);
    expect(removeToken(store, 'missing')).toBe(-1);
    expect(removeToken(store, 'x'.repeat(30))).toBe(0);
  });
});

describe('freshestPerAccount', () => {
  test('collapses to one freshest token per account, keeps unscoped', () => {
    const rows: StoredPushToken[] = [
      { token: 't1', account: 'acc', registeredAt: '2020-01-01T00:00:00Z', lastSeenAt: '2020-01-01T00:00:00Z' },
      { token: 't2', account: 'acc', registeredAt: '2020-01-02T00:00:00Z', lastSeenAt: '2020-01-02T00:00:00Z' },
      { token: 't3', registeredAt: '2020-01-01T00:00:00Z' },
    ];
    const out = freshestPerAccount(rows);
    expect(out.map((t) => t.token).sort()).toEqual(['t2', 't3']);
  });
});

describe('targetsForAccount', () => {
  test('scopes to account and excludes the sender inbox', () => {
    const rows: StoredPushToken[] = [
      { token: 'mine', account: 'acc', registeredAt: 'now', inboxId: 'self' },
      { token: 'peer', account: 'acc', registeredAt: 'now', inboxId: 'other' },
      { token: 'elsewhere', account: 'zzz', registeredAt: 'now', inboxId: 'other' },
    ];
    const out = targetsForAccount(rows, 'acc', 'self');
    expect(out.map((t) => t.token)).toEqual(['peer']);
  });

  test('excludes via inboxIds array too', () => {
    const rows: StoredPushToken[] = [
      { token: 'multi', account: 'acc', registeredAt: 'now', inboxIds: ['self', 'other'] },
    ];
    expect(targetsForAccount(rows, 'acc', 'self')).toHaveLength(0);
  });
});
