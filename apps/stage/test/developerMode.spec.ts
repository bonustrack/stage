import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { DEFAULT_DEVELOPER_MODE, type DeveloperModeContent } from '@stage-labs/client/xmtp/sync/developerMode';
import { editDeveloperMode } from '../lib/syncedSettings.model';
import { settle } from './helpers';
import { mockAppStorage } from './memoryStorage';

let activeId: string | null = null;
let failRead = false;
let failWrite = false;
let failSelection = false;
let readDelay: (() => Promise<void>) | null = null;
let accountDelay: (() => Promise<void>) | null = null;
const { values, writes } = mockAppStorage({
  read: async () => {
    if (failRead) throw new Error('read unavailable');
    await readDelay?.();
  },
  write: () => {
    if (failWrite) throw new Error('write unavailable');
  },
});
mock.module('../lib/accounts', () => ({
  getSelectedAccount: async () => {
    if (failSelection) throw new Error('selection unavailable');
    const id = activeId;
    await accountDelay?.();
    return id === null ? null : { id };
  },
  getActiveAccountStrict: async () => (activeId === null ? null : { id: activeId }),
}));
const { bumpAccountEpoch } = await import('../lib/accountEpoch');
const { accountSelectionChanged, provideActiveAccountReader } = await import('../lib/accountSelection');
provideActiveAccountReader(async () => {
  const id = activeId;
  await accountDelay?.();
  return id;
});
const { developerModeSync, setDeveloperMode } = await import('../lib/developerMode');
let sequence = 0;
const key = (id: string): string => `developer.mode.${id}`;
const stored = (id: string): unknown => JSON.parse(values.get(key(id)) ?? 'null');

beforeEach(async () => {
  failRead = false;
  failWrite = false;
  failSelection = false;
  readDelay = null;
  accountDelay = null;
  activeId = `account-${++sequence}`;
  bumpAccountEpoch();
  await developerModeSync.load(activeId);
  writes.length = 0;
});

describe('developer mode account preference', () => {
  test('starts OFF, ignores the old unscoped prototype and does not snapshot an unset preference', async () => {
    values.set('developer.enabled', '1');
    expect(DEFAULT_DEVELOPER_MODE.enabled).toBe(false);
    expect(await developerModeSync.load('unset')).toBeNull();
    const broken: [string, string][] = [
      ['bad-json', '{'],
      ['bad-shape', '{"enabled":"yes","at":10}'],
    ];
    for (const [id, raw] of broken) {
      values.set(key(id), raw);
      expect(await developerModeSync.load(id)).toBeNull();
    }
    expect(writes).toEqual([]);
  });

  test('persists ON and OFF for the account and emits only local edits', async () => {
    const id = activeId ?? '';
    const sent: { accountId: string; state: DeveloperModeContent }[] = [];
    const stop = developerModeSync.onLocalChange((change) => sent.push(change));
    try {
      await setDeveloperMode(true);
      const on = await developerModeSync.load(id);
      expect(on?.enabled).toBe(true);
      expect(on?.at).toBeGreaterThan(0);
      expect(stored(id)).toEqual(on);
      await setDeveloperMode(true);
      expect(sent).toHaveLength(1);
      await setDeveloperMode(false);
      const off = await developerModeSync.load(id);
      expect(off?.enabled).toBe(false);
      expect(off?.at).toBeGreaterThan(on?.at ?? 0);
      expect(stored(id)).toEqual(off);
      expect(sent.map((change) => [change.accountId, change.state.enabled])).toEqual([
        [id, true],
        [id, false],
      ]);
      await developerModeSync.applyRemote(id, { enabled: true, at: (off?.at ?? 0) + 1 });
      expect(sent).toHaveLength(2);
    } finally {
      stop();
    }
  });

  test('restores persisted state across account reloads without importing another account', async () => {
    const original = activeId ?? '';
    await setDeveloperMode(true);
    const saved = await developerModeSync.load(original);
    activeId = 'reload-other';
    bumpAccountEpoch();
    await settle();
    expect(await developerModeSync.load('reload-other')).toBeNull();
    await setDeveloperMode(true);
    await setDeveloperMode(false);
    activeId = original;
    bumpAccountEpoch();
    await settle();
    expect(await developerModeSync.load(original)).toEqual(saved);
    expect(await developerModeSync.load('reload-other')).toMatchObject({ enabled: false });
    values.set(key('persisted-device'), JSON.stringify(saved));
    expect(await developerModeSync.load('persisted-device')).toEqual(saved);
  });

  test('merges newer remote state, rejects stale ON and resolves equal clocks OFF', async () => {
    const id = activeId ?? '';
    const at = Date.now() + 1000;
    await developerModeSync.applyRemote(id, { enabled: false, at });
    await developerModeSync.applyRemote(id, { enabled: true, at });
    await developerModeSync.applyRemote(id, { enabled: true, at: at - 1 });
    expect(await developerModeSync.load(id)).toEqual({ enabled: false, at });
    await setDeveloperMode(true);
    expect(await developerModeSync.load(id)).toEqual({ enabled: true, at: at + 1 });
    expect(editDeveloperMode({ enabled: true, at: 100 }, false, 50)).toEqual({ enabled: false, at: 101 });
  });

  test('concurrent targeted remote updates preserve the newest durable state', async () => {
    await Promise.all([
      developerModeSync.applyRemote('remote-only', { enabled: false, at: 20 }),
      developerModeSync.applyRemote('remote-only', { enabled: true, at: 19 }),
      developerModeSync.applyRemote('remote-only', { enabled: true, at: 20 }),
    ]);
    expect(stored('remote-only')).toEqual({ enabled: false, at: 20 });
    expect(await developerModeSync.load(activeId ?? '')).toBeNull();
  });

  test('does not write or emit when account selection changes during a local edit', async () => {
    const oldId = activeId ?? '';
    const gate = Promise.withResolvers<undefined>();
    accountDelay = () => gate.promise;
    const pending = setDeveloperMode(true);
    activeId = 'switched-during-edit';
    accountSelectionChanged();
    accountDelay = null;
    gate.resolve(undefined);
    await pending;
    await settle();
    expect(stored(oldId)).toBeNull();
    expect(stored('switched-during-edit')).toBeNull();
    expect(writes).toEqual([]);
  });

  test('does not write stale data after a failed read or announce a failed durable write', async () => {
    const sent: DeveloperModeContent[] = [];
    const stop = developerModeSync.onLocalChange((change) => sent.push(change.state));
    try {
      failRead = true;
      await expect(setDeveloperMode(true)).rejects.toThrow('read unavailable');
      expect(writes).toEqual([]);
      failRead = false;
      failWrite = true;
      await expect(setDeveloperMode(true)).rejects.toThrow('write unavailable');
      expect(sent).toEqual([]);
      failWrite = false;
      expect(await developerModeSync.load(activeId ?? '')).toBeNull();
    } finally {
      stop();
    }
  });

  test('switching during a queued durable read cancels the old local edit', async () => {
    const oldId = activeId ?? '';
    const gate = Promise.withResolvers<undefined>();
    readDelay = () => gate.promise;
    const pending = setDeveloperMode(true);
    await settle();
    activeId = 'switched-during-storage';
    accountSelectionChanged();
    readDelay = null;
    gate.resolve(undefined);
    await pending;
    await settle();
    expect(stored(oldId)).toBeNull();
    expect(stored('switched-during-storage')).toBeNull();
    expect(writes).toEqual([]);
  });

  test('account hydration cannot restore the previous account over the selected account', async () => {
    values.set(key('hydrating-old'), JSON.stringify({ enabled: true, at: 10 }));
    values.set(key('hydrating-new'), JSON.stringify({ enabled: false, at: 20 }));
    const gate = Promise.withResolvers<undefined>();
    readDelay = () => gate.promise;
    activeId = 'hydrating-old';
    bumpAccountEpoch();
    await settle();
    activeId = 'hydrating-new';
    bumpAccountEpoch();
    readDelay = null;
    gate.resolve(undefined);
    await settle();
    expect(await developerModeSync.load('hydrating-new')).toEqual({ enabled: false, at: 20 });
    expect(await developerModeSync.load('hydrating-old')).toEqual({ enabled: true, at: 10 });
    expect(writes).toEqual([]);
  });

  test('unreadable selection rejects rather than writing the fallback account', async () => {
    const sent: DeveloperModeContent[] = [];
    const stop = developerModeSync.onLocalChange((change) => sent.push(change.state));
    try {
      failSelection = true;
      await expect(setDeveloperMode(true)).rejects.toThrow('selection unavailable');
      expect(writes).toEqual([]);
      expect(sent).toEqual([]);
    } finally {
      stop();
    }
  });

  test('no active account cannot enable the preference', async () => {
    activeId = null;
    bumpAccountEpoch();
    await settle();
    await setDeveloperMode(true);
    expect(writes).toEqual([]);
  });
});
