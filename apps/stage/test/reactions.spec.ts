import { describe, expect, test } from 'bun:test';
import type { HistoryEntry } from '@stage-labs/client/types';
import { ownReactionsByMessage, reactionsByMessage } from '../components/conversation/feed-helpers';
import {
  reactorNamer, reactorNames, reactorNamesByMessage, reactorsLabel, type ReactorNamer,
} from '../components/conversation/reactors.model';
import { ownsReaction, reactionPills } from '../components/bubble/reactions.model';

const ME = 'stage://xmtp/user/me';
const EMMA = 'stage://xmtp/user/emma';
const ALICE = 'stage://xmtp/user/alice';
const BOB = 'stage://xmtp/user/bob';
const NO_POLLS = new Map<string, number>();
const nameOf: ReactorNamer = uri => uri.slice(uri.lastIndexOf('/') + 1);

const react = (ms: number, from: string, emoji: string, removed = false): HistoryEntry => ({
  id: `${from}-${ms}`, ts: new Date(ms).toISOString(), station: 'xmtp', line: 'l', from, to: 'b',
  payload: { reactTo: 'm1', emoji, removed },
});

function pillsOf(events: HistoryEntry[], adds: string[] = [], removals: string[] = []) {
  const named = reactorNamesByMessage(reactionsByMessage(events, NO_POLLS), ME, nameOf).get('m1');
  const own = ownReactionsByMessage(events, ME, NO_POLLS).get('m1');
  return reactionPills(named, own, adds, removals);
}

describe('reactions per sender', () => {
  test('one sender removing keeps the other sender on the same emoji', () => {
    const events = [react(1000, EMMA, '👍'), react(2000, ME, '👍'), react(3000, ME, '👍', true)];
    expect(reactionsByMessage(events, NO_POLLS).get('m1')?.get('👍')).toEqual([EMMA]);
    expect(ownReactionsByMessage(events, ME, NO_POLLS).get('m1')).toBeUndefined();
    expect(pillsOf(events)).toEqual([{ emoji: '👍', names: ['emma'], own: false, pending: false }]);
  });

  test('add, remove, add again by one sender counts once', () => {
    const events = [
      react(1000, ME, '👍'), react(2000, ME, '👍', true), react(3000, ME, '👍'), react(4000, BOB, '👍'),
    ];
    expect(reactionsByMessage(events, NO_POLLS).get('m1')?.get('👍')).toEqual([ME, BOB]);
    expect(ownReactionsByMessage(events, ME, NO_POLLS).get('m1')).toEqual(new Set(['👍']));
    expect(pillsOf(events)).toEqual([{ emoji: '👍', names: ['You', 'bob'], own: true, pending: false }]);
  });

  test('a remove with no earlier add changes nothing', () => {
    const events = [react(1000, EMMA, '🔥'), react(2000, ME, '👍', true), react(3000, BOB, '🔥', true)];
    expect(reactionsByMessage(events, NO_POLLS).get('m1')).toEqual(new Map([['🔥', [EMMA]]]));
    expect(ownReactionsByMessage(events, ME, NO_POLLS).size).toBe(0);
    expect(pillsOf(events)).toEqual([{ emoji: '🔥', names: ['emma'], own: false, pending: false }]);
  });
});

describe('pending reactions on screen', () => {
  const emmaOnly = [react(1000, EMMA, '👍')];
  const both = [...emmaOnly, react(2000, ME, '👍')];

  test('my pending add joins the existing pill', () => {
    expect(pillsOf(emmaOnly, ['👍'])).toEqual([{ emoji: '👍', names: ['You', 'emma'], own: true, pending: false }]);
  });

  test('my pending removal drops only me', () => {
    expect(pillsOf(both, [], ['👍'])).toEqual([{ emoji: '👍', names: ['emma'], own: false, pending: false }]);
  });

  test('my pending removal of the last reaction hides the pill', () => {
    expect(pillsOf([react(1000, ME, '👍')], [], ['👍'])).toEqual([]);
  });

  test('a pending add of a new emoji shows as pending', () => {
    expect(pillsOf(emmaOnly, ['🎉'])).toEqual([
      { emoji: '👍', names: ['emma'], own: false, pending: false },
      { emoji: '🎉', names: ['You'], own: true, pending: true },
    ]);
  });

  test('a stale removal no longer hides other reactors once mine is gone', () => {
    expect(pillsOf(emmaOnly, [], ['👍'])).toEqual([{ emoji: '👍', names: ['emma'], own: false, pending: false }]);
  });

  test('tapping toggles from what I see, pending state first', () => {
    expect(ownsReaction(false, false, false)).toBe(false);
    expect(ownsReaction(true, false, false)).toBe(true);
    expect(ownsReaction(true, false, true)).toBe(false);
    expect(ownsReaction(false, true, false)).toBe(true);
  });
});

const addresses: Record<string, string> = {
  [ALICE]: '0xa11ce00000000000000000000000000000000001',
  [BOB]: '0xb0b0000000000000000000000000000000000002',
};
const tooltipNameOf = reactorNamer(uri => addresses[uri] ?? null, address => (address === addresses[ALICE] ? 'Alice' : undefined));

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
    expect(reactorNames([ALICE, BOB, ME], ME, tooltipNameOf)).toEqual(['You', 'Alice', '0xb0b0…0002']);
    expect(reactorNames([BOB], ME, tooltipNameOf)).toEqual(['0xb0b0…0002']);
    expect(tooltipNameOf('stage://xmtp/user/5f1e2d3c4b5a69788796a5b4c3d2e1f0')).toBe('5f1e2d…e1f0');
    const named = reactorNamesByMessage(new Map([['m1', new Map([['👍', [BOB, ME]]])]]), ME, tooltipNameOf);
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
