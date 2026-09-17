import { describe, expect, test } from 'bun:test';
import {
  webXmtpDbPath, canReuseSavedClient, installationCreatedAtMs, openSavedClient,
} from '../src/xmtp/clientConfig';
import { dbDirFor } from '../src/accounts/registry';

describe('webXmtpDbPath', () => {
  test('matches inline derivation', () => {
    expect(webXmtpDbPath('acct1', 'production')).toBe(`${dbDirFor('acct1')}-production.db3`);
    expect(webXmtpDbPath('acct1', 'dev')).toBe(`${dbDirFor('acct1')}-dev.db3`);
  });
});

describe('canReuseSavedClient', () => {
  test('true when address case-insensitively equal and env equal', () => {
    expect(canReuseSavedClient('0xABC', 'production', '0xabc', 'production')).toBe(true);
  });
  test('false on env mismatch', () => {
    expect(canReuseSavedClient('0xabc', 'dev', '0xabc', 'production')).toBe(false);
  });
  test('false on address mismatch', () => {
    expect(canReuseSavedClient('0xdef', 'production', '0xabc', 'production')).toBe(false);
  });
  test('false when nothing saved', () => {
    expect(canReuseSavedClient(null, null, '0xabc', 'production')).toBe(false);
  });
});

describe('installationCreatedAtMs', () => {
  test('ns to ms', () => {
    expect(installationCreatedAtMs(2_000_000n)).toBe(2);
  });
  test('null/undefined passthrough', () => {
    expect(installationCreatedAtMs(null)).toBeNull();
    expect(installationCreatedAtMs(undefined)).toBeNull();
  });
});

describe('openSavedClient', () => {
  const deps = (over: Partial<Parameters<typeof openSavedClient<string>>[0]>) => {
    const calls: string[] = [];
    const d = {
      reusable: true,
      build: () => { calls.push('build'); return Promise.resolve('built'); },
      isRegistered: () => Promise.resolve(true),
      close: (c: string) => { calls.push(`close:${c}`); },
      create: () => { calls.push('create'); return Promise.resolve('created'); },
      onFallback: (reason: string) => { calls.push(`fallback:${reason}`); },
      ...over,
    };
    return { d, calls };
  };

  test('a registered saved installation is reused', async () => {
    const { d, calls } = deps({});
    expect(await openSavedClient(d)).toEqual({ client: 'built', created: false });
    expect(calls).toEqual(['build']);
  });

  test('an unregistered saved installation is closed and a fresh client is created', async () => {
    const { d, calls } = deps({ isRegistered: () => Promise.resolve(false) });
    expect(await openSavedClient(d)).toEqual({ client: 'created', created: true });
    expect(calls).toEqual(['build', 'fallback:unregistered', 'close:built', 'create']);
  });

  test('a failing build falls back to create', async () => {
    const { d, calls } = deps({ build: () => Promise.reject(new Error('locked')) });
    expect(await openSavedClient(d)).toEqual({ client: 'created', created: true });
    expect(calls).toEqual(['fallback:build-failed', 'create']);
  });

  test('a registration probe that throws counts as unregistered', async () => {
    const { d } = deps({ isRegistered: () => Promise.reject(new Error('worker gone')) });
    expect((await openSavedClient(d)).created).toBe(true);
  });

  test('nothing saved goes straight to create', async () => {
    const { d, calls } = deps({ reusable: false });
    expect(await openSavedClient(d)).toEqual({ client: 'created', created: true });
    expect(calls).toEqual(['create']);
  });
});
