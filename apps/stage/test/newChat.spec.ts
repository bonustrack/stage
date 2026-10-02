import { describe, expect, test } from 'bun:test';
import {
  MAX_SHOWN_RECIPIENTS, NO_MEMBER_HISTORY, askPlaceholder, membersDraftKey, newChatDraftKey, parseMemberHistory, pickedRecipients,
  rankedCandidates, recentDmPeers, recipientCandidates, rememberedMembers, savedPicks, shownRecipients, startedChatWith,
} from '../components/home/newChat.model';

const ALICE = '0xA11CE00000000000000000000000000000000001';
const SELF = '0x5e1f000000000000000000000000000000000002';
const POOL = [ALICE];
const BOB = '0xB0B0000000000000000000000000000000000003';
const CAROL = '0xCA10000000000000000000000000000000000004';
const bob = BOB.toLowerCase();
const carol = CAROL.toLowerCase();
const alice = ALICE.toLowerCase();

function dm(peer: string, lastTs: number): { convId: string; peerAddress: string; lastTs: number } {
  return { convId: `c-${peer}-${lastTs}`, peerAddress: peer, lastTs };
}

function candidates(rows: ReturnType<typeof dm>[], requests: ReadonlySet<string> = new Set()): string[] {
  return recipientCandidates(recentDmPeers(rows, SELF), SELF, requests, POOL);
}

describe('new chat recipients', () => {
  test('direct message peers come most recent first, once each, never the account itself', () => {
    const rows = [dm('0xb0b', 10), { convId: 'group', peerAddress: null, lastTs: 50 }, dm('0xC4E', 30), dm('0xb0b', 5), dm(SELF, 40)];
    expect(recentDmPeers(rows, SELF.toUpperCase())).toEqual([{ convId: 'c-0xC4E-30', peer: '0xc4e' }, { convId: 'c-0xb0b-10', peer: '0xb0b' }]);
  });

  test('a new account gets Alice, and she is the one picked by default', () => {
    const list = candidates([]);
    expect(list).toEqual([ALICE.toLowerCase()]);
    expect(pickedRecipients(null, list)).toEqual([ALICE.toLowerCase()]);
  });

  test('Alice follows the recent people and is not repeated when already a contact', () => {
    expect(candidates([dm('0xb0b', 1)])).toEqual(['0xb0b', ALICE.toLowerCase()]);
    expect(candidates([dm('0xb0b', 1), dm(ALICE, 2)])).toEqual([ALICE.toLowerCase(), '0xb0b']);
  });

  test('people who only sent a request are never offered', () => {
    expect(candidates([dm('0xb0b', 2), dm('0xc4e', 1)], new Set(['0xb0b']))).toEqual(['0xc4e', ALICE.toLowerCase()]);
  });

  test('at most five people show, most recent first, and picked people always show', () => {
    const list = candidates(Array.from({ length: 8 }, (_, i) => dm(`0x${i}`, i)));
    expect(list.slice(0, 2)).toEqual(['0x7', '0x6']);
    expect(shownRecipients(list, [], ['0x7'])).toEqual(['0x7', '0x6', '0x5', '0x4', '0x3']);
    expect(shownRecipients(list, [], ['0x0'])).toHaveLength(MAX_SHOWN_RECIPIENTS + 1);
    expect(shownRecipients(['0xa'], [], ['0xgone'])).toEqual(['0xa', '0xgone']);
  });

  test('the first person is picked until the choice is changed, even to nobody', () => {
    expect(pickedRecipients(null, ['0xa', '0xb'])).toEqual(['0xa']);
    expect(pickedRecipients(null, [])).toEqual([]);
    expect(pickedRecipients(['0xb', '0xc'], ['0xa', '0xb'])).toEqual(['0xb', '0xc']);
    expect(pickedRecipients([], ['0xa'])).toEqual([]);
  });

  test('people added by search show before the suggestions, once', () => {
    expect(shownRecipients(['0xa', '0xb'], ['0xd', '0xB'], [])).toEqual(['0xd', '0xa', '0xb']);
  });

  test('the new chat draft is kept per account, and not before the account is known', () => {
    expect(newChatDraftKey({ id: 'a' })).not.toBe(newChatDraftKey({ id: 'b' }));
    expect(newChatDraftKey(null)).toBeNull();
    expect(membersDraftKey('new-chat:a')).not.toBe('new-chat:a');
    expect(membersDraftKey(null)).toBeNull();
  });

  test('saved members come back as they were picked, anything else is ignored', () => {
    expect(savedPicks({ added: ['0xd'], chosen: ['0xd'] })).toEqual({ added: ['0xd'], chosen: ['0xd'] });
    expect(savedPicks({ added: [], chosen: null })).toEqual({ added: [], chosen: null });
    expect(savedPicks('hello')).toBeNull();
    expect(savedPicks({ added: ['0xd'] })).toBeNull();
    expect(savedPicks({ added: [1], chosen: null })).toBeNull();
  });

  test('the composer asks the picked people by name, and keeps its default with nobody picked', () => {
    expect(askPlaceholder([])).toBeUndefined();
    expect(askPlaceholder(['Emma'])).toBe('Ask Emma');
    expect(askPlaceholder(['Emma', 'Alice'])).toBe('Ask Emma and Alice');
    expect(askPlaceholder(['Emma', 'Alice', 'Tony'])).toBe('Ask Emma, Alice and Tony');
    expect(askPlaceholder(['Emma', 'Alice', 'Tony', 'Chen'])).toBe('Ask Emma, Alice and 2 others');
  });
});

describe('new chat member memory', () => {
  test('starting a chat remembers its members and counts one more chat for each of them', () => {
    const once = startedChatWith(NO_MEMBER_HISTORY, [BOB], 10);
    expect(once).toEqual({ last: [bob], stats: { [bob]: { count: 1, at: 10 } } });
    const twice = startedChatWith(once, [CAROL, BOB, 'not-an-address'], 20);
    expect(twice.last).toEqual([carol, bob]);
    expect(twice.stats).toEqual({ [bob]: { count: 2, at: 20 }, [carol]: { count: 1, at: 20 } });
    expect(startedChatWith(twice, ['nobody'], 30)).toBe(twice);
  });

  test('the members of the last chat are picked again, without the account itself or broken entries', () => {
    const history = { last: [BOB, SELF, 'broken'], stats: {} };
    expect(rememberedMembers(history, SELF.toUpperCase())).toEqual([bob]);
    expect(rememberedMembers(NO_MEMBER_HISTORY, SELF)).toEqual([]);
    expect(pickedRecipients(null, [alice], [bob])).toEqual([bob]);
    expect(pickedRecipients(null, [alice], [])).toEqual([alice]);
    expect(pickedRecipients([], [alice], [bob])).toEqual([]);
  });

  test('people rank by chats started, then by the latest chat, then by the usual order', () => {
    const history = startedChatWith(startedChatWith(startedChatWith(NO_MEMBER_HISTORY, [BOB], 1), [CAROL], 2), [BOB], 3);
    expect(rankedCandidates([alice, '0xd'], history, SELF)).toEqual([bob, carol, alice, '0xd']);
    expect(rankedCandidates([alice, bob], history, SELF)).toEqual([bob, carol, alice]);
    const tied = startedChatWith(startedChatWith(NO_MEMBER_HISTORY, [BOB], 1), [CAROL], 2);
    expect(rankedCandidates([bob, carol], tied, SELF)).toEqual([carol, bob]);
    const together = startedChatWith(NO_MEMBER_HISTORY, [BOB, CAROL], 1);
    expect(rankedCandidates([carol, bob], together, SELF)).toEqual([carol, bob]);
    expect(rankedCandidates([alice], { last: [], stats: { [SELF.toLowerCase()]: { count: 9, at: 9 } } }, SELF)).toEqual([alice]);
  });

  test('saved member history comes back as stored, anything else starts empty', () => {
    const history = startedChatWith(NO_MEMBER_HISTORY, [BOB], 5);
    expect(parseMemberHistory(JSON.stringify(history))).toEqual(history);
    expect(parseMemberHistory('nope')).toEqual(NO_MEMBER_HISTORY);
    expect(parseMemberHistory(JSON.stringify({ last: 'x', stats: {} }))).toEqual(NO_MEMBER_HISTORY);
    expect(parseMemberHistory(JSON.stringify({ last: [], stats: { [bob]: { count: 'x' } } }))).toEqual({ last: [], stats: {} });
  });
});
