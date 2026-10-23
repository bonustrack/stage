import { describe, expect, test } from 'bun:test';
import { channelRefToken } from '@stage-labs/client/xmtp/channelRefs';
import { isSyncGroupName } from '@stage-labs/client/xmtp/readState';
import {
  MAX_SHOWN_RECIPIENTS, NO_MEMBER_HISTORY, askPlaceholder, firstMessageChannelName, membersDraftKey, newChatDraftKey, newChatNav, parseMemberHistory, pickedRecipients,
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

describe('firstMessageChannelName', () => {
  test('uses only the plain text, collapsing whitespace and control characters into a single line', () => {
    expect(firstMessageChannelName('  Plan\n\tfor\r\ntomorrow\u0000at\u007fnoon  ')).toBe('Plan for tomorrow at noon');
    expect(firstMessageChannelName('  <script>alert("hello")</script> & café  ')).toBe('<script>alert("hello")</script> & café');
    expect(firstMessageChannelName('proto')).toBe('proto');
  });

  test('uses displayed channel and people mentions rather than wire tokens', () => {
    const text = `Ask @${alice} about ${channelRefToken('roadmap-id', 'Roadmap')}`;
    expect(firstMessageChannelName(text, () => '@Alice')).toBe('Ask @Alice about #Roadmap');
    expect(firstMessageChannelName(channelRefToken('long-id', 'a'.repeat(110)), () => '@Alice')).toBe('#' + 'a'.repeat(96) + '…');
  });

  test('does not create a hidden internal sync group from a message prefix', () => {
    const name = firstMessageChannelName(' stage.sync: debug this ');
    expect(name).toBe('Stage.sync: debug this');
    expect(isSyncGroupName(name)).toBe(false);
  });

  test('empty or attachment-only drafts have no generated name', () => {
    expect(firstMessageChannelName('')).toBeUndefined();
    expect(firstMessageChannelName(' \n\t\u0000 ')).toBeUndefined();
  });

  test('leaves complete names unchanged at the existing UTF-8-byte limit', () => {
    expect(firstMessageChannelName('a'.repeat(100))).toBe('a'.repeat(100));
    expect(firstMessageChannelName('é'.repeat(50))).toBe('é'.repeat(50));
    expect(firstMessageChannelName('界'.repeat(33))).toBe('界'.repeat(33));
    expect(firstMessageChannelName('🙂'.repeat(25))).toBe('🙂'.repeat(25));
    expect(firstMessageChannelName('a'.repeat(100) + ' \n\t')).toBe('a'.repeat(100));
  });

  test('marks actual truncation with an ellipsis inside the UTF-8-byte limit', () => {
    expect(firstMessageChannelName('a'.repeat(101))).toBe('a'.repeat(97) + '…');
    expect(firstMessageChannelName('é'.repeat(51))).toBe('é'.repeat(48) + '…');
    expect(firstMessageChannelName('界'.repeat(34))).toBe('界'.repeat(32) + '…');
    expect(firstMessageChannelName('🙂'.repeat(26))).toBe('🙂'.repeat(24) + '…');
    expect(firstMessageChannelName('a'.repeat(99) + '🙂')).toBe('a'.repeat(97) + '…');
    expect(firstMessageChannelName('a'.repeat(98) + ' ' + '🙂')).toBe('a'.repeat(97) + '…');
  });

  test('does not split graphemes when reserving space for the truncation marker', () => {
    const encoder = new TextEncoder();
    for (const grapheme of ['é', '👍🏿', '🇨🇭', '👩‍💻', '👨‍👩‍👧‍👦', '✈️', 'क्ष', '한']) {
      const prefix = 'a'.repeat(99 - encoder.encode(grapheme).length);
      expect(firstMessageChannelName(prefix + grapheme + 'xx')).toBe(prefix + '…');
      expect(firstMessageChannelName(prefix + grapheme + 'x')).toBe(prefix + grapheme + 'x');
    }
  });

  test('keeps complete graphemes that fit beside the truncation marker', () => {
    const encoder = new TextEncoder();
    for (const grapheme of ['é', '👍🏿', '🇨🇭', '👩‍💻', '👨‍👩‍👧‍👦', '✈️', 'क्ष', '한']) {
      const prefix = 'a'.repeat(97 - encoder.encode(grapheme).length);
      expect(firstMessageChannelName(prefix + grapheme + 'abcd')).toBe(prefix + grapheme + '…');
    }
    expect(firstMessageChannelName('e' + '́'.repeat(100))).toBe('…');
  });

  test('trims collapsed whitespace before the truncation marker', () => {
    expect(firstMessageChannelName('a'.repeat(96) + '\n\t🙂')).toBe('a'.repeat(96) + '…');
    expect(firstMessageChannelName('a'.repeat(96) + ' '.repeat(20) + '🙂')).toBe('a'.repeat(96) + '…');
  });

  test('keeps truncated names visible rather than internal sync names', () => {
    const name = firstMessageChannelName('stage.sync: ' + 'a'.repeat(100));
    expect(name).toBe('Stage.sync: ' + 'a'.repeat(85) + '…');
    expect(isSyncGroupName(name)).toBe(false);
  });
});

describe('newChatNav', () => {
  test('phones push the new chat page', () => {
    expect(newChatNav(false, false, '/')).toEqual({ href: '/new', push: true });
    expect(newChatNav(false, true, '/board')).toEqual({ href: '/new', push: true });
  });

  test('desktop chats view goes home, where the new chat lives', () => {
    expect(newChatNav(true, false, '/channel/abc')).toEqual({ href: '/', push: false });
  });

  test('desktop board opens it beside the board like a channel', () => {
    expect(newChatNav(true, true, '/board')).toEqual({ href: '/new', push: true });
    expect(newChatNav(true, true, '/channel/abc')).toEqual({ href: '/new', push: false });
  });
});
