/** Tests for multi-link card extraction in message bubbles. The bubble renders
 *  one card per card-generating link; this pure helper drives that, so it's run
 *  on every bubble render and must stay correct + bounded. */

import { describe, expect, test } from 'bun:test';
import { cardLinksOf, MAX_CARDS } from '../lib/cardLinks';

describe('cardLinksOf', () => {
  test('returns empty for no links / empty / null', () => {
    expect(cardLinksOf('just some text')).toEqual([]);
    expect(cardLinksOf('')).toEqual([]);
    expect(cardLinksOf(null)).toEqual([]);
  });

  test('detects a single github link', () => {
    const cards = cardLinksOf('see https://github.com/bonustrack/metro/pull/321 please');
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ kind: 'github' });
  });

  test('renders one card per distinct card link, in order of appearance', () => {
    const text = [
      'preview https://github.com/bonustrack/metro/issues/501',
      'channel metro://xmtp/47bf58a8f56cad829b2263797a7e25e4',
      'build metro://expo-development-client/?url=https://u.expo.dev/abc/group/grp123',
    ].join(' ');
    const cards = cardLinksOf(text);
    expect(cards.map(c => c.kind)).toEqual(['github', 'channel', 'preview']);
  });

  test('dedupes identical urls', () => {
    const url = 'https://github.com/bonustrack/metro';
    const cards = cardLinksOf(`${url} and again ${url}`);
    expect(cards).toHaveLength(1);
  });

  test('classifies a DM link as dm, not channel', () => {
    const cards = cardLinksOf('metro://xmtp/user/0x1234567890123456789012345678901234567890');
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ kind: 'dm' });
  });

  test('caps at MAX_CARDS, extra links drop out', () => {
    const links = Array.from({ length: MAX_CARDS + 3 }, (_, i) =>
      `https://github.com/owner/repo${i}`).join(' ');
    expect(cardLinksOf(links)).toHaveLength(MAX_CARDS);
  });
});
