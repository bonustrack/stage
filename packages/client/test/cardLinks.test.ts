import { describe, expect, test } from 'bun:test';
import { cardLinksOf, previewLinkOf } from '../src/embed/cardLinks';
import type { LinkFinder } from '../src/xmtp/messageBody';

const findLinks: LinkFinder = text => [...text.matchAll(/(?:https?:\/\/|stage:\/\/|metro:\/\/)\S+/gi)].map(m => (
  { index: m.index, lastIndex: m.index + m[0].length, url: m[0] }
));
const cardsOf = (text?: string | null) => cardLinksOf(text, findLinks);
const CONV = '47bf58a8f56cad829b2263797a7e25e4';
const ADDRESS = '0x42e167e6bff0a3a701d8fa14f96a0f840eb939df';
const GROUP = '521df401-53f1-4413-b95a-c682dc054134';
const PROJECT = '1707f2db-c2b8-4c91-9341-27b1d57d355f';
const EXPO = `https://u.expo.dev/${PROJECT}/group/${GROUP}`;
const ENCODED = encodeURIComponent(EXPO);

const SPECIAL_LINKS = [
  [`stage://${ADDRESS}`, 'dm'],
  [`https://stage.box/#/${ADDRESS}`, 'dm'],
  [`https://stage.box/user/${ADDRESS}`, 'dm'],
  [`metro://xmtp/user/${ADDRESS}`, 'dm'],
  [`stage://channel/${CONV}?m=abc&focus=1`, 'channel'],
  [`https://stage.box/#/channel/${CONV}`, 'channel'],
  [`https://stage.box/channel/${CONV}`, 'channel'],
  [`stage://xmtp/${CONV}`, 'channel'],
  [`metro://xmtp/${CONV}`, 'channel'],
  ['https://youtu.be/dQw4w9WgXcQ', 'youtube'],
  ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=12', 'youtube'],
  ['https://www.google.com/maps/search/?api=1&query=12.3456,-65.4321', 'map'],
  ['https://www.openstreetmap.org/?mlat=12.3456&mlon=-65.4321#map=16/12.3456/-65.4321', 'map'],
  ['https://github.com/bonustrack/stage/pull/321?diff=split#discussion', 'github'],
  [`stage://expo-development-client/?url=${EXPO}`, 'preview'],
  [`metro://expo-development-client/?url=${EXPO}`, 'preview'],
  [`https://stage.box/preview-launcher.html?u=${ENCODED}`, 'preview'],
  ['https://example.com/page?q=one%20two#section', 'generic'],
  ['http://example.com/page', 'generic'],
] as const;

describe('cardLinksOf', () => {
  test('classifies one supported URL with surrounding whitespace allowed', () => {
    for (const [url, kind] of SPECIAL_LINKS) {
      expect(cardsOf(url)).toMatchObject([{ kind }]);
      expect(cardsOf(` \n\t${url}\r\n `)).toEqual(cardsOf(url));
    }
  });

  test('rejects prose and multiple links before deduplication or classification', () => {
    for (const [url] of SPECIAL_LINKS) {
      for (const text of [`read ${url}`, `${url} please`, `${url}\nhello`, `hello\n${url}`,
        `${url} ${url}`, `${url}\n${url}`, `${url}\t${url}`, `${url} https://example.org`,
        `${url}\nhttps://example.org`]) {
        expect(cardsOf(text)).toEqual([]);
      }
    }
  });

  test('rejects wrappers, code, nonlinks and unsupported schemes', () => {
    for (const text of [undefined, null, '', ' \n\t', 'just text', 'example.com', 'https://',
      'ftp://example.com', 'mailto:a@example.com', 'javascript:alert(1)', 'stage://unknown',
      '<https://example.com>', '[docs](https://example.com)', '**https://example.com**',
      '`https://example.com`', '```\nhttps://example.com\n```', `[#Ops](stage://channel/${CONV})`]) {
      expect(cardsOf(text)).toEqual([]);
    }
  });

  test('requires a single parser match covering the entire trimmed message', () => {
    const url = 'https://example.com';
    expect(cardLinksOf(url, () => null)).toEqual([]);
    expect(cardLinksOf(`${url}.`, () => [{ index: 0, lastIndex: url.length, url }])).toEqual([]);
    expect(cardLinksOf(url, () => [{ index: 1, lastIndex: url.length, url }])).toEqual([]);
    expect(cardLinksOf(url, () => [
      { index: 0, lastIndex: url.length, url }, { index: 0, lastIndex: url.length, url },
    ])).toEqual([]);
  });

  test('preserves classifier URLs even when they differ from the complete input', () => {
    expect(cardsOf('https://github.com/bonustrack/stage/pull/321?diff=split#discussion')).toEqual([
      { kind: 'github', url: 'https://github.com/bonustrack/stage/pull/321' },
    ]);
    expect(cardsOf('https://example.com/page?q=one%20two#section')).toEqual([
      { kind: 'generic', url: 'https://example.com/page?q=one%20two#section' },
    ]);
  });
});

describe('previewLinkOf', () => {
  test('legacy-scheme dev-client link (raw inner url)', () => {
    const r = previewLinkOf(`metro://expo-development-client/?url=${EXPO}`);
    expect(r?.groupId).toBe(GROUP);
  });

  test('stage:// dev-client link', () => {
    const r = previewLinkOf(`stage://expo-development-client/?url=${EXPO}`);
    expect(r?.groupId).toBe(GROUP);
  });

  test('https preview-launcher form with percent-encoded inner url', () => {
    const r = previewLinkOf(`https://stage.box/preview-launcher.html?u=${ENCODED}`);
    expect(r?.groupId).toBe(GROUP);
    expect(r?.url).toBe(`https://stage.box/preview-launcher.html?u=${ENCODED}`);
  });

  test('null for unrelated links', () => {
    expect(previewLinkOf('https://example.com/foo')).toBeNull();
    expect(previewLinkOf(null)).toBeNull();
  });
});
