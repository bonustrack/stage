import { describe, expect, test } from 'bun:test';
import type { HistoryEntry } from '@stage-labs/client/types';
import { ownReactionsByMessage, reactionsByMessage } from '../components/conversation/feed-helpers';
import { reactorNamesByMessage, type ReactorNamer } from '../components/conversation/reactors.model';
import { ownsReaction, reactionPills } from '../components/bubble/reactions.model';

const ME = 'stage://xmtp/user/me';
const EMMA = 'stage://xmtp/user/emma';
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
