import { describe, expect, test } from 'bun:test';
import type { AccountRecord } from '@stage-labs/client/accounts/types';
import { NoAccountError, installationsOf, makeClientLifecycle } from '../lib/xmtp.client.core';

function account(id: string): AccountRecord {
  return { id, address: `0x${id}`, type: 'generated', dbDir: `db-${id}`, createdAt: 0 };
}

interface FakeClient { id: string; address: string }

function harness(initial: AccountRecord[], activeId: string | null) {
  const log: string[] = [];
  let records = [...initial];
  let active = activeId;
  let cached: FakeClient | null = null;
  let failBuild = false;
  const lifecycle = makeClientLifecycle<FakeClient>({
    accounts: {
      active: () => Promise.resolve(records.find(r => r.id === active) ?? null),
      list: () => Promise.resolve(records),
      setActive: (id) => { log.push(`setActive:${id}`); active = id; return Promise.resolve(); },
      remove: (id) => { log.push(`remove:${id}`); records = records.filter(r => r.id !== id); return Promise.resolve(); },
    },
    store: {
      deleteFiles: (dir) => { log.push(`deleteFiles:${dir}`); return Promise.resolve(); },
      deleteKey: (id) => { log.push(`deleteKey:${id}`); return Promise.resolve(); },
      wipe: (id, dir) => { log.push(`wipe:${id}:${dir}`); return Promise.resolve(); },
      forgetSaved: (id) => { log.push(`forget:${id}`); return Promise.resolve(); },
    },
    client: {
      get: () => cached,
      getOrCreate: async (create) => { cached ??= await create(); return cached; },
      build: (rec) => {
        log.push(`build:${rec.id}`);
        return failBuild ? Promise.reject(new Error('boom')) : Promise.resolve({ id: rec.id, address: rec.address });
      },
      dispose: () => { log.push('dispose'); cached = null; },
      selfAddressOf: (c) => c.address,
      syncPreferences: () => Promise.resolve(),
      installations: () => Promise.resolve([]),
      installationIdOf: (c) => c.id,
      revoke: (_c, acct, installationId) => { log.push(`revoke:${acct.id}:${installationId}`); return Promise.resolve(); },
    },
    bumpEpoch: () => { log.push('epoch'); },
  });
  return { log, lifecycle, setFailBuild: (v: boolean) => { failBuild = v; } };
}

describe('makeClientLifecycle', () => {
  test('without an active account the client cannot be created', async () => {
    const { lifecycle, log } = harness([], null);
    expect(lifecycle.cachedSelfEthAddress()).toBeNull();
    await expect(lifecycle.xmtpClient()).rejects.toBeInstanceOf(NoAccountError);
    await expect(lifecycle.revokeXmtpInstallation('x')).rejects.toBeInstanceOf(NoAccountError);
    expect(log).toEqual([]);
  });

  test('switching disposes the old client before activating and building the new one', async () => {
    const { lifecycle, log } = harness([account('a'), account('b')], 'a');
    expect((await lifecycle.xmtpClient()).id).toBe('a');
    const switched = await lifecycle.switchToAccount('b');
    expect(switched.id).toBe('b');
    expect(log).toEqual(['build:a', 'dispose', 'setActive:b', 'build:b', 'epoch']);
    expect(lifecycle.cachedSelfEthAddress()).toBe('0xb');
  });

  test('a failed switch still bumps the epoch and rethrows', async () => {
    const { lifecycle, log, setFailBuild } = harness([account('a'), account('b')], 'a');
    setFailBuild(true);
    await expect(lifecycle.switchToAccount('b')).rejects.toThrow('boom');
    expect(log).toEqual(['dispose', 'setActive:b', 'build:b', 'epoch']);
    await expect(lifecycle.switchToAccount('missing')).rejects.toThrow('Account not found.');
  });

  test('deleting removes the record, its store and saved client, disposes, then bumps the epoch', async () => {
    const { lifecycle, log } = harness([account('a'), account('b')], 'a');
    await lifecycle.deleteAccount('b');
    expect(log).toEqual(['remove:b', 'deleteFiles:db-b', 'deleteKey:b', 'forget:b', 'dispose', 'epoch']);
  });

  test('resetting the active store wipes it and is a no-op without an account', async () => {
    const withAccount = harness([account('a')], 'a');
    await withAccount.lifecycle.resetActiveXmtpStore();
    expect(withAccount.log).toEqual(['dispose', 'wipe:a:db-a', 'forget:a']);
    const empty = harness([], null);
    await empty.lifecycle.resetActiveXmtpStore();
    expect(empty.log).toEqual([]);
  });

  test('revoking goes through the active account', async () => {
    const { lifecycle, log } = harness([account('a')], 'a');
    await lifecycle.revokeXmtpInstallation('inst-1');
    expect(log).toEqual(['build:a', 'revoke:a:inst-1']);
  });
});

describe('installationsOf', () => {
  test('marks the current installation and sorts newest first', () => {
    const list = [{ id: 'old', createdAt: 1 }, { id: 'unknown', createdAt: undefined }, { id: 'new', createdAt: 5 }];
    expect(installationsOf(list, 'old')).toEqual([
      { id: 'new', createdAt: 5, current: false },
      { id: 'old', createdAt: 1, current: true },
      { id: 'unknown', createdAt: undefined, current: false },
    ]);
  });
});
