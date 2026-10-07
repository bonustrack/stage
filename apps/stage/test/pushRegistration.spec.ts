import { describe, expect, test } from 'bun:test';
import { createHmac } from 'node:crypto';
import {
  makePushRegistrar, type PushRegistrationInput,
} from '../lib/pushRegistration.core';
import type { PushSubscriptionJson } from '@stage-labs/client/xmtp/pushServer';

const GROUP = '/xmtp/mls/1/g-abcdef/proto';
const DM = '/xmtp/mls/1/g-012345/proto';
const WELCOME = '/xmtp/mls/1/w-mobile/proto';
const PERIOD = 691;
const OLD_KEY = new Uint8Array(42).fill(1);
const OWNER_KEY = new Uint8Array(42).fill(2);
const OTHER_KEY = new Uint8Array(42).fill(3);
const ENVELOPE = new TextEncoder().encode('synthetic MLS ciphertext');

function fixture(timeoutMs?: number) {
  const controller = new AbortController();
  const cacheErrors: unknown[] = [];
  const stored = new Map<string, string>();
  const subscriptions = new Map<string, PushSubscriptionJson[]>();
  const calls: string[] = [];
  const statuses: string[] = [];
  let key = OLD_KEY;
  let period = PERIOD;
  let token = 'synthetic-token';
  let now = 1_000;
  let current = true;
  let failPost = false;
  let failRead = false;
  let failSync = false;
  let failWrite = false;
  let sync: () => Promise<void> = () => Promise.resolve();
  let beforePost: () => Promise<void> = () => Promise.resolve();
  let beforeRead: () => void = () => undefined;
  const { register, unregister } = makePushRegistrar({
    timeoutMs,
    cacheError: error => { cacheErrors.push(error); },
    remove: async id => { stored.delete(id); },
    read: async id => { beforeRead(); if (failRead) throw new Error('disk unavailable'); return stored.get(id) ?? null; },
    write: async (id, value) => { if (failWrite) throw new Error('quota exceeded'); stored.set(id, value); },
    post: async (url, body) => {
      await beforePost();
      if (failPost) throw new Error('offline');
      calls.push(url);
      if (url === 'SubscribeWithMetadata') {
        const request = body as { installationId: string; subscriptions: PushSubscriptionJson[] };
        subscriptions.set(request.installationId, request.subscriptions);
      }
      if (url === 'DeleteInstallation') subscriptions.delete((body as { installationId: string }).installationId);
    },
    now: () => now,
    status: status => { statuses.push(status); },
  });
  const input: PushRegistrationInput = {
    installationId: 'mobile', platform: 'android', current: () => current, signal: controller.signal,
    rpcUrl: method => method, getToken: async () => token,
    syncPreferences: async () => { if (failSync) throw new Error('sync failed'); await sync(); },
    collectTopics: async () => ({
      topics: [GROUP, DM, WELCOME],
      hmacKeys: Object.fromEntries([GROUP, DM].map(topic => [topic, [{ thirtyDayPeriodsSinceEpoch: period, hmacKey: key }]])),
    }),
  };
  const delivers = (installationId: string, topic: string, senderKey: Uint8Array): boolean => {
    const sub = subscriptions.get(installationId)?.find(item => item.topic === topic);
    const own = sub?.hmacKeys.find(item => item.thirtyDayPeriodsSinceEpoch === period);
    if (!own) return true;
    const expected = createHmac('sha256', Buffer.from(own.key, 'base64')).update(ENVELOPE).digest();
    return !expected.equals(createHmac('sha256', senderKey).update(ENVELOPE).digest());
  };
  return {
    input, register, unregister, calls, statuses, stored, subscriptions, delivers, cacheErrors,
    abort: () => { controller.abort(); }, setWriteFailure: (value: boolean) => { failWrite = value; },
    setKey: (value: Uint8Array) => { key = value; }, setPeriod: (value: number) => { period = value; },
    setToken: (value: string) => { token = value; }, setNow: (value: number) => { now = value; },
    setCurrent: (value: boolean) => { current = value; }, setPostFailure: (value: boolean) => { failPost = value; },
    setReadFailure: (value: boolean) => { failRead = value; }, setSyncFailure: (value: boolean) => { failSync = value; },
    onSync: (value: () => Promise<void>) => { sync = value; },
    onPost: (value: () => Promise<void>) => { beforePost = value; },
    onRead: (value: () => void) => { beforeRead = value; },
  };
}

function deferred() {
  let release = (): void => undefined;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}

describe('inbox sender-filter registration', () => {
  test('refreshes same-topic inbox HMAC keys for server sender filtering in DMs and groups', async () => {
    const f = fixture();
    await f.register(f.input);
    expect(f.delivers('mobile', GROUP, OWNER_KEY)).toBe(true);
    f.setKey(OWNER_KEY);
    await f.register(f.input);
    expect(f.calls).toEqual(['RegisterInstallation', 'SubscribeWithMetadata', 'SubscribeWithMetadata']);
    for (const topic of [GROUP, DM]) {
      expect(f.delivers('mobile', topic, OWNER_KEY)).toBe(false);
      expect(f.delivers('mobile', topic, OTHER_KEY)).toBe(true);
    }
    expect(f.subscriptions.get('mobile')?.find(sub => sub.topic === WELCOME)).toEqual({ topic: WELCOME, hmacKeys: [], isSilent: true });
    expect(f.stored.get('mobile')).not.toContain(Buffer.from(OWNER_KEY).toString('base64'));
  });

  test('syncs the inbox preferences before reading keys on cold registration', async () => {
    const f = fixture();
    f.onSync(async () => { f.setKey(OWNER_KEY); });
    await f.register(f.input);
    expect(f.delivers('mobile', GROUP, OWNER_KEY)).toBe(false);
  });

  test('repairs the old topic-only cache without waiting for the token TTL', async () => {
    const f = fixture();
    f.stored.set('mobile', JSON.stringify({ token: 'synthetic-token', at: 1_000, topics: [GROUP, DM, WELCOME].sort().join('\n') }));
    await f.register(f.input);
    expect(f.calls).toEqual(['SubscribeWithMetadata']);
  });

  test('skips unchanged subscriptions but refreshes rotated periods and renewed tokens', async () => {
    const f = fixture();
    await f.register(f.input);
    await f.register(f.input);
    expect(f.calls).toHaveLength(2);
    f.setPeriod(PERIOD + 1);
    await f.register(f.input);
    expect(f.calls).toHaveLength(3);
    f.setToken('renewed-token');
    await f.register(f.input);
    expect(f.calls.slice(-2)).toEqual(['RegisterInstallation', 'SubscribeWithMetadata']);
    f.setNow(24 * 60 * 60 * 1_000);
    await f.register(f.input);
    expect(f.calls).toHaveLength(7);
  });

  test('reordering SDK keys and topics is unchanged, but adding a topic resubscribes', async () => {
    const f = fixture();
    const first = await f.input.collectTopics();
    first.hmacKeys[GROUP] = [
      { thirtyDayPeriodsSinceEpoch: PERIOD, hmacKey: OWNER_KEY },
      { thirtyDayPeriodsSinceEpoch: PERIOD + 1, hmacKey: OTHER_KEY },
    ];
    await f.register({ ...f.input, collectTopics: async () => first });
    const reversed = { ...first, topics: [...first.topics].reverse(), hmacKeys: {
      ...first.hmacKeys, [GROUP]: [...(first.hmacKeys[GROUP] ?? [])].reverse(),
    } };
    await f.register({ ...f.input, collectTopics: async () => reversed });
    expect(f.calls).toHaveLength(2);
    expect(reversed.hmacKeys[GROUP][0]?.thirtyDayPeriodsSinceEpoch).toBe(PERIOD + 1);
    await f.register({ ...f.input, collectTopics: async () => ({ ...first, topics: [...first.topics, '/xmtp/mls/1/g-new/proto'] }) });
    expect(f.calls).toHaveLength(3);
  });

  test('repairs a persisted same-installation registration on process restart', async () => {
    const before = fixture();
    await before.register(before.input);
    const restarted = fixture();
    for (const [id, state] of before.stored) restarted.stored.set(id, state);
    for (const [id, subscriptions] of before.subscriptions) restarted.subscriptions.set(id, subscriptions);
    restarted.setKey(OWNER_KEY);
    await restarted.register(restarted.input);
    expect(restarted.calls).toEqual(['SubscribeWithMetadata']);
    expect(restarted.delivers('mobile', GROUP, OWNER_KEY)).toBe(false);
  });

  test('keeps each account installation separate and never suppresses another account', async () => {
    const f = fixture();
    f.setKey(OWNER_KEY);
    await f.register(f.input);
    f.setKey(OTHER_KEY);
    await f.register({ ...f.input, installationId: 'other-account' });
    expect(f.delivers('mobile', GROUP, OWNER_KEY)).toBe(false);
    expect(f.delivers('other-account', GROUP, OWNER_KEY)).toBe(true);
    expect(f.delivers('other-account', GROUP, OTHER_KEY)).toBe(false);
    expect(f.stored.size).toBe(2);
  });

  test('does not register without a token or while the captured session is stale', async () => {
    const f = fixture();
    f.setToken('');
    expect(await f.register(f.input)).toBe(false);
    expect(f.statuses).toEqual(['no-token']);
    f.setToken('synthetic-token');
    f.setCurrent(false);
    expect(await f.register(f.input)).toBe(false);
    expect(f.calls).toEqual([]);
  });

  test('stops after an account switch during token, preference, topic or storage reads', async () => {
    for (const phase of ['token', 'sync', 'topics', 'storage']) {
      const f = fixture();
      const input = { ...f.input };
      if (phase === 'token') input.getToken = async () => { f.setCurrent(false); return 'token'; };
      if (phase === 'sync') f.onSync(async () => { f.setCurrent(false); });
      if (phase === 'topics') input.collectTopics = async () => { f.setCurrent(false); return { topics: [], hmacKeys: {} }; };
      if (phase === 'storage') f.onRead(() => { f.setCurrent(false); });
      expect(await f.register(input)).toBe(false);
      expect(f.calls).toEqual([]);
      expect(f.stored.size).toBe(0);
    }
  });

  test('a switch during HTTP never saves an outdated registration or reports it as ready', async () => {
    const f = fixture();
    f.onPost(async () => { f.setCurrent(false); });
    expect(await f.register(f.input)).toBe(false);
    expect(f.calls).toEqual(['RegisterInstallation']);
    expect(f.stored.size).toBe(0);
    expect(f.statuses).not.toContain('registered');
  });

  test('failed sync, storage and subscription requests remain retryable', async () => {
    const f = fixture();
    f.setSyncFailure(true);
    await expect(f.register(f.input)).rejects.toThrow('sync failed');
    f.setSyncFailure(false);
    f.setReadFailure(true);
    await expect(f.register(f.input)).rejects.toThrow('disk unavailable');
    f.setReadFailure(false);
    f.setPostFailure(true);
    await expect(f.register(f.input)).rejects.toThrow('offline');
    expect(f.stored.size).toBe(0);
    f.setPostFailure(false);
    expect(await f.register(f.input)).toBe(true);
  });

  test('serializes key refreshes so an earlier request cannot overwrite newer keys', async () => {
    const f = fixture();
    const gate = deferred();
    const entered = deferred();
    f.onPost(async () => { entered.release(); await gate.promise; });
    const first = f.register(f.input);
    await entered.promise;
    f.setKey(OWNER_KEY);
    const second = f.register(f.input);
    gate.release();
    await Promise.all([first, second]);
    expect(f.calls).toEqual(['RegisterInstallation', 'SubscribeWithMetadata', 'SubscribeWithMetadata']);
    expect(f.delivers('mobile', GROUP, OWNER_KEY)).toBe(false);
  });

  test('discards queued registration from the old session after a switch', async () => {
    const f = fixture();
    const gate = deferred();
    const entered = deferred();
    f.onSync(async () => { entered.release(); await gate.promise; });
    const first = f.register(f.input);
    await entered.promise;
    const second = f.register(f.input);
    f.setCurrent(false);
    gate.release();
    expect(await Promise.all([first, second])).toEqual([false, false]);
    expect(f.calls).toEqual([]);
  });

  test('a closed worker cannot block the same installation on the replacement session', async () => {
    const f = fixture();
    const entered = deferred();
    f.onSync(() => { entered.release(); return new Promise(() => undefined); });
    const abandoned = f.register(f.input);
    await entered.promise;
    f.abort();
    await expect(abandoned).rejects.toThrow('cancelled');
    f.onSync(async () => undefined);
    expect(await f.register({ ...f.input, signal: new AbortController().signal })).toBe(true);
  });

  test('a hung SDK call times out without poisoning future refreshes', async () => {
    const f = fixture(10);
    f.onSync(() => new Promise(() => undefined));
    await expect(f.register(f.input)).rejects.toThrow('timed out');
    f.onSync(async () => undefined);
    expect(await f.register(f.input)).toBe(true);
  });

  test('disable during the first subscription waits and deletes remote state without a cache record', async () => {
    const f = fixture();
    const entered = deferred();
    const gate = deferred();
    f.onPost(async () => { if (f.calls.length === 1) { entered.release(); await gate.promise; } });
    const registering = f.register(f.input);
    await entered.promise;
    expect(f.stored.size).toBe(0);
    f.setCurrent(false);
    const removing = f.unregister('mobile', method => method);
    gate.release();
    expect(await registering).toBe(false);
    await removing;
    expect(f.calls).toEqual(['RegisterInstallation', 'SubscribeWithMetadata', 'DeleteInstallation']);
    expect(f.subscriptions.size).toBe(0);
    expect(f.stored.size).toBe(0);
  });

  test('successful remote registration remains successful when optional cache persistence fails', async () => {
    const f = fixture();
    f.setWriteFailure(true);
    expect(await f.register(f.input)).toBe(true);
    expect(f.cacheErrors).toHaveLength(1);
    expect(f.subscriptions.has('mobile')).toBe(true);
    expect(f.statuses.at(-1)).toBe('registered');
  });

  test('repairs malformed stored registrations', async () => {
    for (const raw of ['', '{', '{}', '{"token":3,"at":0}', '{"token":"t","at":"now"}']) {
      const f = fixture();
      f.stored.set('mobile', raw);
      expect(await f.register(f.input)).toBe(true);
      expect(f.calls).toEqual(['RegisterInstallation', 'SubscribeWithMetadata']);
    }
  });
});
