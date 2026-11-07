import { describe, expect, test } from 'bun:test';
import { bumpAccountEpoch } from '../lib/accountEpoch';
import { accountSelectionChanged } from '../lib/accountSelection';
import { accountQueryKey, getQueryClient } from '../lib/queryClient';

function cachedKeys(): unknown[] {
  return getQueryClient()
    .getQueryCache()
    .getAll()
    .map((query) => query.queryKey);
}

describe('account query keys', () => {
  test('a key carries the moment it follows and the current generation of that moment', () => {
    const before = accountQueryKey('selection', 'payerBalance', 8453);
    accountSelectionChanged();
    const after = accountQueryKey('selection', 'payerBalance', 8453);
    expect(before.slice(0, 2)).toEqual(['account', 'selection']);
    expect(after[2]).toBe(before[2] + 1);
    expect(accountQueryKey('client', 'xmtpIdentity').slice(0, 2)).toEqual(['account', 'client']);
  });

  test('each account moment clears the queries of the previous generation it scopes, and only those', () => {
    const client = getQueryClient();
    const wallet = accountQueryKey('selection', 'payerBalance');
    const roles = accountQueryKey('client', 'xmtp', 'conv', 'c1', 'roles');
    const shared = ['linkPreview', 'https://stage.box'];
    client.setQueryData(wallet, 'old balance');
    client.setQueryData(roles, 'old roles');
    client.setQueryData(shared, 'preview');
    accountSelectionChanged();
    expect(cachedKeys()).toEqual([roles, shared]);
    const nextRoles = accountQueryKey('client', 'xmtp', 'conv', 'c1', 'roles');
    client.setQueryData(nextRoles, 'new roles');
    bumpAccountEpoch();
    expect(cachedKeys()).toEqual([shared]);
  });
});
