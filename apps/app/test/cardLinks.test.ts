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

  /** Scheme links (metro:// and stage://) must yield the SAME card as their https
   *  equivalents — the app ships under both brands and both schemes. */
  test('stage:// and metro:// channel links each render a channel card', () => {
    const cards = cardLinksOf(
      'stage://xmtp/47bf58a8f56cad829b2263797a7e25e4 and metro://xmtp/47bf58a8f56cad829b2263797a7e25e4',
    );
    expect(cards.map(c => c.kind)).toEqual(['channel', 'channel']);
  });

  test('https metro.box / stage.box user links render a dm card', () => {
    const addr = '0x42e167e6bff0a3a701d8fa14f96a0f840eb939df';
    expect(cardLinksOf(`https://stage.box/user/${addr}`)[0]).toMatchObject({ kind: 'dm' });
    expect(cardLinksOf(`https://metro.box/user/${addr}`)[0]).toMatchObject({ kind: 'dm' });
  });

  /** A user link mid-sentence (not the whole body) still produces its card. */
  test('detects a stage.box user link surrounded by text', () => {
    const addr = '0x0bA043c6F25085C68042bad079c29bD8f16a651A';
    const cards = cardLinksOf(`check out https://stage.box/user/${addr} when you have a sec`);
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ kind: 'dm' });
  });

  /** Newline-separated multi-link body: each link on its own line is its own card. */
  test('handles newline-separated links (two github + a user link)', () => {
    const text = [
      'Test 1 - two GitHub links + a user link:',
      'https://github.com/bonustrack/metro/pull/502',
      'https://github.com/bonustrack/metro/issues/486',
      'https://stage.box/user/0x42e167e6bff0a3a701d8fa14f96a0f840eb939df',
    ].join('\n');
    expect(cardLinksOf(text).map(c => c.kind)).toEqual(['github', 'github', 'dm']);
  });

  /** The https preview-launcher form (?u=<encoded expo url>) is a preview card,
   *  same as the metro:// expo-development-client deep link. */
  test('detects the https preview-launcher deep link', () => {
    const text = [
      'Test 2 - mixed: deployment + channel + GitHub:',
      'https://metro.box/preview-launcher.html?u=https%3A%2F%2Fu.expo.dev%2F1707f2db-c2b8-4c91-9341-27b1d57d355f%2Fgroup%2F521df401-53f1-4413-b95a-c682dc054134',
      'metro://xmtp/47bf58a8f56cad829b2263797a7e25e4',
      'https://github.com/bonustrack/metro/pull/505',
    ].join('\n');
    expect(cardLinksOf(text).map(c => c.kind)).toEqual(['preview', 'channel', 'github']);
  });

  /** A plain http(s) link with no special detector match becomes a generic
   *  OpenGraph preview card (metadata fetched client-side via the proxy). */
  test('a plain web link is a generic preview card', () => {
    const cards = cardLinksOf('read this https://www.bbc.com/news/article-123 great piece');
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ kind: 'generic', url: 'https://www.bbc.com/news/article-123' });
  });

  /** Trailing sentence punctuation the greedy token match swallows is stripped
   *  from the generic card url so the preview fetch + tap target are clean. */
  test('strips trailing punctuation from a generic link url', () => {
    const cards = cardLinksOf('see (https://example.com/page).');
    expect(cards[0]).toMatchObject({ kind: 'generic', url: 'https://example.com/page' });
  });

  /** Generic cards coexist with special cards under the same MAX_CARDS cap and
   *  appearance order. */
  test('generic + special links stack in order', () => {
    const text = [
      'https://github.com/bonustrack/metro',
      'https://news.ycombinator.com/item?id=1',
      'metro://xmtp/47bf58a8f56cad829b2263797a7e25e4',
    ].join(' ');
    expect(cardLinksOf(text).map(c => c.kind)).toEqual(['github', 'generic', 'channel']);
  });
});
