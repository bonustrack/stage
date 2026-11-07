import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { PublicClient } from 'viem';
import { resolveOnchainProfile } from '../src/identity/onchainProfile';
import { createPeerProfiles } from '../src/identity/peerProfiles';
import { fakeFetch } from './helpers';

const profiles = createPeerProfiles();

const TONY = '0x0000000000000000000000000000000000000001';
const NAMELESS = '0x0000000000000000000000000000000000000002';
const RENAMED = '0x0000000000000000000000000000000000000003';
const FRESH = '0x0000000000000000000000000000000000000004';
const ALICE = '0x0000000000000000000000000000000000000005';
const NAMED_ALICE = '0x0000000000000000000000000000000000000006';

let lookups: string[][] = [];
let answer: Record<string, string> = {};
const realFetch = globalThis.fetch;

beforeEach(() => {
  lookups = [];
  globalThis.fetch = fakeFetch(async (_url, init) => {
    const parsed = JSON.parse(String(init?.body ?? '{}')) as { params?: string[] };
    lookups.push(parsed.params ?? []);
    return new Response(JSON.stringify({ result: answer }));
  });
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

async function settled(): Promise<void> {
  for (let tick = 0; tick < 2; tick += 1) {
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  }
}

async function ensureCountingNotices(store: ReturnType<typeof createPeerProfiles>, address: string): Promise<number> {
  let notified = 0;
  const unsubscribe = store.subscribe(() => {
    notified += 1;
  });
  store.ensure([address]);
  await settled();
  unsubscribe();
  return notified;
}

describe('seeded profiles are usable before the network answers', () => {
  test('a seeded name resolves and renders at once', () => {
    profiles.seed({ [TONY]: 'Tony', [NAMELESS]: null });
    expect(profiles.isResolved(TONY)).toBe(true);
    expect(profiles.name(TONY)).toBe('Tony');
    expect(profiles.isResolved(NAMELESS)).toBe(true);
    expect(profiles.name(NAMELESS)).toBeUndefined();
  });

  test('a stage name shows as @username unless a display name is set', () => {
    profiles.seed({ [ALICE]: { name: 'alice321.stage.base.eth' } });
    expect(profiles.name(ALICE)).toBe('@alice321');
    profiles.seed({ [NAMED_ALICE]: { name: 'alice321.stage.base.eth', displayName: 'Alice from Stage' } });
    expect(profiles.name(NAMED_ALICE)).toBe('Alice from Stage');
  });

  test('seeding never overwrites a name the session already fetched', async () => {
    answer = { [FRESH]: 'Fresh' };
    profiles.ensure([FRESH]);
    await settled();
    profiles.seed({ [FRESH]: 'Old' });
    expect(profiles.name(FRESH)).toBe('Fresh');
  });
});

describe('a seeded profile is still refreshed from the network', () => {
  test('ensure looks a seeded address up again, and stays quiet when nothing changed', async () => {
    profiles.seed({ [TONY]: 'Tony' });
    answer = { [TONY]: 'Tony' };
    const notified = await ensureCountingNotices(profiles, TONY);
    expect(lookups.flat()).toContain(TONY);
    expect(notified).toBe(0);
    expect(profiles.name(TONY)).toBe('Tony');
  });

  test('a refreshed address is not looked up twice', async () => {
    profiles.ensure([TONY]);
    await settled();
    expect(lookups.flat().filter((a) => a === TONY)).toHaveLength(0);
  });

  test('a changed name notifies subscribers', async () => {
    profiles.seed({ [RENAMED]: 'Before' });
    answer = { [RENAMED]: 'After' };
    expect(await ensureCountingNotices(profiles, RENAMED)).toBe(1);
    expect(profiles.name(RENAMED)).toBe('After');
  });
});

describe('the store can be mirrored to disk', () => {
  test('entries carry every known address, nameless ones as null', () => {
    const entries = profiles.entries();
    expect(entries[TONY]).toBe('Tony');
    expect(entries[NAMELESS]).toBeNull();
    expect(entries[RENAMED]).toBe('After');
  });
});

describe('a flaky RPC never wipes a cached profile', () => {
  const avatarReadFails = {
    readContract: async ({ functionName, args }: { functionName: string; args?: unknown[] }) => {
      if (functionName === 'text' && args?.[1] === 'avatar') throw new Error('rpc down');
      if (functionName === 'resolver') return '0x00000000000000000000000000000000000000C0';
      if (functionName === 'name') return 'tony.base.eth';
      return functionName === 'addr' ? TONY : '';
    },
  } as unknown as PublicClient;

  test('a failed avatar read keeps the cached avatar and changes nothing', async () => {
    const flaky = createPeerProfiles({ resolveOnchain: (address) => resolveOnchainProfile(avatarReadFails, address) });
    flaky.seed({ [TONY]: { name: 'tony.base.eth', avatar: 'ipfs://cached', source: 'basename' } });
    answer = { [TONY]: 'tony.base.eth' };
    const notified = await ensureCountingNotices(flaky, TONY);
    expect(flaky.avatar(TONY)).toBe('ipfs://cached');
    expect(notified).toBe(0);
  });
});
