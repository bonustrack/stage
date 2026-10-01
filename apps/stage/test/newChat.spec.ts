import { describe, expect, test } from 'bun:test';
import {
  MAX_SHOWN_RECIPIENTS, chatKey, phaseNote, pickedRecipients, recentPeers, recipientCandidates, shownRecipients,
} from '../components/home/newChat.model';

const ALICE = '0xA11CE00000000000000000000000000000000001';
const SELF = '0x5e1f000000000000000000000000000000000002';
const POOL = [ALICE];

function dm(peer: string, lastTs: number): { peerAddress: string; lastTs: number } {
  return { peerAddress: peer, lastTs };
}

describe('new chat recipients', () => {
  test('direct message peers come most recent first, once each, never the account itself', () => {
    const rows = [dm('0xb0b', 10), { peerAddress: null, lastTs: 50 }, dm('0xC4E', 30), dm('0xb0b', 5), dm(SELF, 40)];
    expect(recentPeers(rows, SELF.toUpperCase())).toEqual(['0xc4e', '0xb0b']);
  });

  test('a new account gets Alice, and she is the one picked by default', () => {
    const candidates = recipientCandidates([], SELF, POOL);
    expect(candidates).toEqual([ALICE.toLowerCase()]);
    expect(pickedRecipients(null, candidates)).toEqual([ALICE.toLowerCase()]);
  });

  test('Alice follows the recent people and is not repeated when already a contact', () => {
    expect(recipientCandidates([dm('0xb0b', 1)], SELF, POOL)).toEqual(['0xb0b', ALICE.toLowerCase()]);
    expect(recipientCandidates([dm('0xb0b', 1), dm(ALICE, 2)], SELF, POOL)).toEqual([ALICE.toLowerCase(), '0xb0b']);
  });

  test('at most five people show, most recent first, unless more are picked', () => {
    const rows = Array.from({ length: 8 }, (_, i) => dm(`0x${i}`, i));
    const candidates = recipientCandidates(rows, SELF, POOL);
    expect(candidates.slice(0, 2)).toEqual(['0x7', '0x6']);
    expect(shownRecipients(candidates, [], ['0x7'])).toEqual(['0x7', '0x6', '0x5', '0x4', '0x3']);
    expect(shownRecipients(candidates, [], ['0x0'])).toHaveLength(MAX_SHOWN_RECIPIENTS + 1);
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

  test('a created chat is reused only for the same people', () => {
    expect(chatKey(['0xB0B'])).toBe(chatKey(['0xb0b']));
    expect(chatKey(['0xb0b', '0xa11ce'])).toBe(chatKey(['0xA11CE', '0xB0B']));
    expect(chatKey(['0xa11ce'])).not.toBe(chatKey(['0xa11ce', '0xb0b']));
  });

  test('the note follows the phase', () => {
    expect(phaseNote('idle')).toBeNull();
    expect(phaseNote('creating')).toBe('Creating the chat…');
    expect(phaseNote('sending')).toBe('Sending…');
  });
});
