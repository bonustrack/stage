import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  ensurePeerProfiles, getPeerName, isPeerResolved, peerProfileEntries,
  seedPeerProfiles, subscribePeerProfiles,
} from '../src/identity/peerProfiles';

const TONY = '0x0000000000000000000000000000000000000001';
const NAMELESS = '0x0000000000000000000000000000000000000002';
const RENAMED = '0x0000000000000000000000000000000000000003';
const FRESH = '0x0000000000000000000000000000000000000004';

let lookups: string[][] = [];
let answer: Record<string, string> = {};
const realFetch = globalThis.fetch;

beforeEach(() => {
  lookups = [];
  globalThis.fetch = (async (_url: unknown, init?: { body?: string }) => {
    const parsed = JSON.parse(init?.body ?? '{}') as { params?: string[] };
    lookups.push(parsed.params ?? []);
    return new Response(JSON.stringify({ result: answer }));
  }) as unknown as typeof fetch;
});

afterEach(() => { globalThis.fetch = realFetch; });

async function settled(): Promise<void> {
  await new Promise(resolve => { setTimeout(resolve, 0); });
  await new Promise(resolve => { setTimeout(resolve, 0); });
}

describe('seeded profiles are usable before the network answers', () => {
  test('a seeded name resolves and renders at once', () => {
    seedPeerProfiles({ [TONY]: 'Tony', [NAMELESS]: null });
    expect(isPeerResolved(TONY)).toBe(true);
    expect(getPeerName(TONY)).toBe('Tony');
    expect(isPeerResolved(NAMELESS)).toBe(true);
    expect(getPeerName(NAMELESS)).toBeUndefined();
  });

  test('seeding never overwrites a name the session already fetched', async () => {
    answer = { [FRESH]: 'Fresh' };
    ensurePeerProfiles([FRESH]);
    await settled();
    seedPeerProfiles({ [FRESH]: 'Old' });
    expect(getPeerName(FRESH)).toBe('Fresh');
  });
});

describe('a seeded profile is still refreshed from the network', () => {
  test('ensure looks a seeded address up again, and stays quiet when nothing changed', async () => {
    seedPeerProfiles({ [TONY]: 'Tony' });
    answer = { [TONY]: 'Tony' };
    let notified = 0;
    const unsubscribe = subscribePeerProfiles(() => { notified += 1; });
    ensurePeerProfiles([TONY]);
    await settled();
    unsubscribe();
    expect(lookups.flat()).toContain(TONY);
    expect(notified).toBe(0);
    expect(getPeerName(TONY)).toBe('Tony');
  });

  test('a refreshed address is not looked up twice', async () => {
    ensurePeerProfiles([TONY]);
    await settled();
    expect(lookups.flat().filter(a => a === TONY)).toHaveLength(0);
  });

  test('a changed name notifies subscribers', async () => {
    seedPeerProfiles({ [RENAMED]: 'Before' });
    answer = { [RENAMED]: 'After' };
    let notified = 0;
    const unsubscribe = subscribePeerProfiles(() => { notified += 1; });
    ensurePeerProfiles([RENAMED]);
    await settled();
    unsubscribe();
    expect(notified).toBe(1);
    expect(getPeerName(RENAMED)).toBe('After');
  });
});

describe('the store can be mirrored to disk', () => {
  test('entries carry every known address, nameless ones as null', () => {
    const entries = peerProfileEntries();
    expect(entries[TONY]).toBe('Tony');
    expect(entries[NAMELESS]).toBeNull();
    expect(entries[RENAMED]).toBe('After');
  });
});
