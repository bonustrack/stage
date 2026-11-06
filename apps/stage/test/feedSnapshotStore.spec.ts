import { describe, expect, mock, test } from 'bun:test';
import { knownActiveAccountId } from '../lib/accountSelection';
import { decodeSnapshot } from '../lib/feed/snapshot.model';
import { selectAccount } from './activeAccount';
import { entry } from './helpers';

const stored = new Map<string, string>();
const pending = new Map<string, () => string | Promise<string>>();

mock.module('../lib/cache', () => ({
  createRecordStore: () => ({
    read: async (name: string) => stored.get(name) ?? null,
    write: (name: string, text: () => string | Promise<string>) => {
      pending.set(name, text);
    },
    remove: async (name: string) => {
      pending.delete(name);
      stored.delete(name);
    },
  }),
}));
mock.module('../lib/accounts', () => ({ currentAccountId: async () => knownActiveAccountId() }));

const { cachedFeed, cachedSelfInboxId, forgetFeeds, rememberFeed, rememberSelfInboxId } = await import('../lib/feed/snapshot.web');

async function flush(): Promise<void> {
  for (const [name, text] of pending) stored.set(name, await text());
  pending.clear();
}

describe('the web feed snapshot', () => {
  test('keeps the sent messages of a feed for the active account and writes them once flushed', async () => {
    selectAccount('alice');
    rememberFeed('stage://xmtp/a', [entry('sending', { pending: true }), entry('m2'), entry('m1')]);
    expect((await cachedFeed('stage://xmtp/a'))?.map((e) => e.id)).toEqual(['m2', 'm1']);
    rememberSelfInboxId('inbox-alice');
    await Promise.resolve();
    expect(await cachedSelfInboxId()).toBe('inbox-alice');
    await flush();
    const written = decodeSnapshot(stored.get('feed-snapshot.alice') ?? '');
    expect(written?.self).toBe('inbox-alice');
    expect(written?.lines.map((l) => l.entries.map((e) => e.id))).toEqual([['m2', 'm1']]);
  });

  test('reads another account from its own record', async () => {
    selectAccount('bob');
    expect(await cachedFeed('stage://xmtp/a')).toBeNull();
    expect(await cachedSelfInboxId()).toBeNull();
  });

  test('forgetting an account drops its snapshot and its record', async () => {
    selectAccount('alice');
    await forgetFeeds('alice');
    expect(stored.has('feed-snapshot.alice')).toBe(false);
    expect(await cachedFeed('stage://xmtp/a')).toBeNull();
  });

  test('no account selected means nothing is kept', async () => {
    selectAccount(null);
    rememberFeed('stage://xmtp/b', [entry('m1')]);
    expect(pending.size).toBe(0);
    expect(await cachedFeed('stage://xmtp/b')).toBeNull();
  });
});
