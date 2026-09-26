import { describe, expect, test } from 'bun:test';
import type { HistoryEntry } from '@stage-labs/client/types';
import { reactionsByMessage } from '../components/conversation/feed-helpers';
import {
  reactorNamer, reactorNames, reactorNamesByMessage, reactorsLabel,
} from '../components/conversation/reactors.model';

const ME = 'stage://xmtp/user/me';
const ALICE = 'stage://xmtp/user/alice';
const BOB = 'stage://xmtp/user/bob';

const react = (ms: number, from: string, emoji: string, removed = false): HistoryEntry => ({
  id: `${from}-${ms}`, ts: new Date(ms).toISOString(), station: 'xmtp', line: 'l', from, to: 'b',
  payload: { reactTo: 'm1', emoji, removed },
});

const addresses: Record<string, string> = {
  [ALICE]: '0xa11ce00000000000000000000000000000000001',
  [BOB]: '0xb0b0000000000000000000000000000000000002',
};
const nameOf = reactorNamer(uri => addresses[uri] ?? null, address => (address === addresses[ALICE] ? 'Alice' : undefined));

describe('reaction tooltip', () => {
  test('lists each reactor once, by their latest reaction', () => {
    const events = [
      react(1000, ALICE, '👍'), react(2000, BOB, '👍'), react(3000, BOB, '👍', true),
      react(4000, ME, '👍'), react(5000, BOB, '🔥'), react(6000, ALICE, '👍'),
    ];
    const byEmoji = reactionsByMessage(events, new Map()).get('m1');
    expect(byEmoji?.get('👍')).toEqual([ALICE, ME]);
    expect(byEmoji?.get('🔥')).toEqual([BOB]);
  });

  test('names reactors with you first, then profile name, then a short address', () => {
    expect(reactorNames([ALICE, BOB, ME], ME, nameOf)).toEqual(['You', 'Alice', '0xb0b0…0002']);
    expect(reactorNames([BOB], ME, nameOf)).toEqual(['0xb0b0…0002']);
    expect(nameOf('stage://xmtp/user/5f1e2d3c4b5a69788796a5b4c3d2e1f0')).toBe('5f1e2d…e1f0');
    const named = reactorNamesByMessage(new Map([['m1', new Map([['👍', [BOB, ME]]])]]), ME, nameOf);
    expect(named.get('m1')?.get('👍')).toEqual(['You', '0xb0b0…0002']);
  });

  test('caps the label and counts the rest', () => {
    expect(reactorsLabel(['You'])).toBe('You');
    expect(reactorsLabel(['You', 'Alice'])).toBe('You and Alice');
    expect(reactorsLabel(['You', 'Alice', 'Bob'])).toBe('You, Alice and Bob');
    expect(reactorsLabel(['You', 'Alice', 'Bob', 'Carol'])).toBe('You, Alice and 2 others');
    expect(reactorsLabel(Array.from({ length: 10 }, (_, i) => `u${i}`))).toBe('u0, u1 and 8 others');
  });
});
