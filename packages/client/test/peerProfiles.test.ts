import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
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
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
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
    let notified = 0;
    const unsubscribe = profiles.subscribe(() => {
      notified += 1;
    });
    profiles.ensure([TONY]);
    await settled();
    unsubscribe();
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
    let notified = 0;
    const unsubscribe = profiles.subscribe(() => {
      notified += 1;
    });
    profiles.ensure([RENAMED]);
    await settled();
    unsubscribe();
    expect(notified).toBe(1);
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
