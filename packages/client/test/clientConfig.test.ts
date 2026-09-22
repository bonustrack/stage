import { describe, expect, test } from 'bun:test';
import {
  webXmtpDbPath, canReuseSavedClient, installationCreatedAtMs, openPersistedClient, OPEN_ATTEMPTS,
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

describe('openPersistedClient', () => {
  type Deps = Parameters<typeof openPersistedClient<string>>[0];
  const deps = (over: Partial<Deps>) => {
    const calls: string[] = [];
    const d: Deps = {
      open: () => { calls.push('open'); return Promise.resolve('inst-a'); },
      isRegistered: () => Promise.resolve(true),
      register: () => { calls.push('register'); return Promise.resolve(); },
      installationIdOf: (c: string) => c,
      close: (c: string) => { calls.push(`close:${c}`); },
      savedInstallationId: 'inst-a',
      retryable: () => true,
      sleep: () => { calls.push('sleep'); return Promise.resolve(); },
      onEvent: (event: string) => { calls.push(`event:${event}`); },
      ...over,
    };
    return { d, calls };
  };

  test('a registered persisted installation is reused without registering', async () => {
    const { d, calls } = deps({});
    expect(await openPersistedClient(d)).toEqual({ client: 'inst-a', registered: false });
    expect(calls).toEqual(['open']);
  });

  test('an unregistered persisted installation is registered in place, never replaced', async () => {
    const { d, calls } = deps({ isRegistered: () => Promise.resolve(false) });
    expect(await openPersistedClient(d)).toEqual({ client: 'inst-a', registered: true });
    expect(calls).toEqual(['open', 'register', 'event:registered']);
  });

  test('a fresh device registers whatever installation the store holds', async () => {
    const { d, calls } = deps({ savedInstallationId: null, isRegistered: () => Promise.resolve(false) });
    expect(await openPersistedClient(d)).toEqual({ client: 'inst-a', registered: true });
    expect(calls).toEqual(['open', 'register', 'event:registered']);
  });

  test('a store that opens with a changing installation is closed and retried, never registered', async () => {
    let opens = 0;
    const { d, calls } = deps({ open: () => { opens += 1; return Promise.resolve(opens < 3 ? `inst-memory-${opens}` : 'inst-a'); } });
    expect(await openPersistedClient(d)).toEqual({ client: 'inst-a', registered: false });
    expect(calls).toEqual([
      'event:installation-mismatch', 'close:inst-memory-1', 'sleep',
      'event:installation-mismatch', 'close:inst-memory-2', 'sleep',
    ]);
  });

  test('a mismatch that changes on every attempt gives up with the locked-store error', async () => {
    let opens = 0;
    const { d, calls } = deps({ open: () => { opens += 1; return Promise.resolve(`inst-memory-${opens}`); }, attempts: 2 });
    await expect(openPersistedClient(d)).rejects.toThrow(/another tab/);
    expect(calls.filter(c => c === 'register')).toEqual([]);
    expect(calls.filter(c => c.startsWith('close'))).toHaveLength(2);
  });

  test('a store that keeps opening with the same unexpected installation is adopted and registered if needed', async () => {
    let registered = false;
    const { d, calls } = deps({
      open: () => Promise.resolve('inst-b'),
      isRegistered: () => Promise.resolve(registered),
      register: () => { registered = true; calls.push('register'); return Promise.resolve(); },
    });
    expect(await openPersistedClient(d)).toEqual({ client: 'inst-b', registered: true });
    expect(calls).toEqual([
      'event:installation-mismatch', 'close:inst-b', 'sleep',
      'event:installation-adopted', 'register', 'event:registered',
    ]);
  });

  test('a lock between two identical mismatches still adopts the store', async () => {
    let opens = 0;
    const { d, calls } = deps({
      open: () => {
        opens += 1;
        if (opens === 2) return Promise.reject(new Error('NoModificationAllowedError'));
        return Promise.resolve('inst-b');
      },
    });
    expect(await openPersistedClient(d)).toEqual({ client: 'inst-b', registered: false });
    expect(calls).toEqual([
      'event:installation-mismatch', 'close:inst-b', 'sleep',
      'event:open-failed', 'sleep',
      'event:installation-adopted',
    ]);
  });

  test('a failing open is retried and the last error surfaces', async () => {
    let opens = 0;
    const { d, calls } = deps({ open: () => { opens += 1; return opens < 2 ? Promise.reject(new Error('locked')) : Promise.resolve('inst-a'); } });
    expect(await openPersistedClient(d)).toEqual({ client: 'inst-a', registered: false });
    expect(calls).toEqual(['event:open-failed', 'sleep']);
    const failing = deps({ open: () => Promise.reject(new Error('locked')), attempts: 3 });
    await expect(openPersistedClient(failing.d)).rejects.toThrow('locked');
    expect(failing.calls.filter(c => c === 'event:open-failed')).toHaveLength(3);
  });

  test('an open error the seam calls final is thrown after a single attempt', async () => {
    let opens = 0;
    const { d, calls } = deps({ open: () => { opens += 1; return Promise.reject(new Error('12/10 installations')); }, retryable: () => false });
    await expect(openPersistedClient(d)).rejects.toThrow('12/10');
    expect(opens).toBe(1);
    expect(calls).toEqual(['event:open-failed']);
  });

  test('a registration probe that throws surfaces instead of creating a new installation', async () => {
    const { d, calls } = deps({ isRegistered: () => Promise.reject(new Error('worker gone')) });
    await expect(openPersistedClient(d)).rejects.toThrow('worker gone');
    expect(calls).toEqual(['open']);
  });

  test('defaults to five attempts', () => {
    expect(OPEN_ATTEMPTS).toBe(5);
  });
});
