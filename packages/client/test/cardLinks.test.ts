
import { describe, expect, test } from 'bun:test';
import { channelRefToken } from '../src/xmtp/channelRefs';
import { cardLinksOf, MAX_CARDS, previewLinkOf } from '../src/embed/cardLinks';

describe('cardLinksOf', () => {
  test('returns empty for no links / empty / null', () => {
    expect(cardLinksOf('just some text')).toEqual([]);
    expect(cardLinksOf('')).toEqual([]);
    expect(cardLinksOf(null)).toEqual([]);
  });

  test('detects a single github link', () => {
    const cards = cardLinksOf('see https://github.com/bonustrack/stage/pull/321 please');
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ kind: 'github' });
  });

  test('renders one card per distinct card link, in order of appearance', () => {
    const text = [
      'preview https://github.com/bonustrack/stage/issues/501',
      'channel metro://xmtp/47bf58a8f56cad829b2263797a7e25e4',
      'build metro://expo-development-client/?url=https://u.expo.dev/abc/group/grp123',
    ].join(' ');
    const cards = cardLinksOf(text);
    expect(cards.map(c => c.kind)).toEqual(['github', 'preview']);
  });

  test('dedupes identical urls', () => {
    const url = 'https://github.com/bonustrack/stage';
    const cards = cardLinksOf(`${url} and again ${url}`);
    expect(cards).toHaveLength(1);
  });

  test('classifies a DM link as dm, not channel', () => {
    const cards = cardLinksOf('metro://xmtp/user/0x1234567890123456789012345678901234567890');
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ kind: 'dm' });
  });

  test('classifies a bare (no xmtp) address link as dm', () => {
    const addr = '0x42e167e6bff0a3a701d8fa14f96a0f840eb939df';
    expect(cardLinksOf(`stage://${addr}`)[0]).toMatchObject({ kind: 'dm', peerAddress: addr });
    expect(cardLinksOf(`https://stage.box/#/${addr}`)[0]).toMatchObject({ kind: 'dm' });
  });

  test('shows no card for a channel shared by typing #', () => {
    const conv = '47bf58a8f56cad829b2263797a7e25e4';
    expect(cardLinksOf(`join ${channelRefToken(conv, 'Design')} today`)).toEqual([]);
    expect(cardLinksOf(`${channelRefToken(conv, 'Design')} https://stage.box/#/channel/${conv}`)).toEqual([]);
    expect(cardLinksOf(channelRefToken(conv, 'Design'))).toMatchObject([{ kind: 'channel', convId: conv }]);
  });

  test('classifies a channel/ (no xmtp) conv link as channel', () => {
    const conv = '47bf58a8f56cad829b2263797a7e25e4';
    expect(cardLinksOf(`stage://channel/${conv}`)[0]).toMatchObject({ kind: 'channel', convId: conv });
    expect(cardLinksOf(`https://stage.box/#/channel/${conv}`)[0]).toMatchObject({ kind: 'channel' });
  });

  test('caps at MAX_CARDS, extra links drop out', () => {
    const links = Array.from({ length: MAX_CARDS + 3 }, (_, i) =>
      `https://github.com/owner/repo${i}`).join(' ');
    expect(cardLinksOf(links)).toHaveLength(MAX_CARDS);
  });

  test('current and legacy channel link schemes each render a channel card', () => {
    const conv = '47bf58a8f56cad829b2263797a7e25e4';
    expect(cardLinksOf(`stage://xmtp/${conv}`)).toMatchObject([{ kind: 'channel', convId: conv }]);
    expect(cardLinksOf(`metro://xmtp/${conv}`)).toMatchObject([{ kind: 'channel', convId: conv }]);
    expect(cardLinksOf(`stage://xmtp/${conv} and metro://xmtp/${conv}`)).toEqual([]);
  });

  test('https user links render a dm card', () => {
    const addr = '0x42e167e6bff0a3a701d8fa14f96a0f840eb939df';
    expect(cardLinksOf(`https://stage.box/user/${addr}`)[0]).toMatchObject({ kind: 'dm' });
  });

  test('detects a stage.box user link surrounded by text', () => {
    const addr = '0x0bA043c6F25085C68042bad079c29bD8f16a651A';
    const cards = cardLinksOf(`check out https://stage.box/user/${addr} when you have a sec`);
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ kind: 'dm' });
  });

  test('handles newline-separated links (two github + a user link)', () => {
    const text = [
      'Test 1 - two GitHub links + a user link:',
      'https://github.com/bonustrack/stage/pull/502',
      'https://github.com/bonustrack/stage/issues/486',
      'https://stage.box/user/0x42e167e6bff0a3a701d8fa14f96a0f840eb939df',
    ].join('\n');
    expect(cardLinksOf(text).map(c => c.kind)).toEqual(['github', 'github', 'dm']);
  });

  test('detects the https preview-launcher deep link', () => {
    const text = [
      'Test 2 - mixed: deployment + channel + GitHub:',
      'https://stage.box/preview-launcher.html?u=https%3A%2F%2Fu.expo.dev%2F1707f2db-c2b8-4c91-9341-27b1d57d355f%2Fgroup%2F521df401-53f1-4413-b95a-c682dc054134',
      'metro://xmtp/47bf58a8f56cad829b2263797a7e25e4',
      'https://github.com/bonustrack/stage/pull/505',
    ].join('\n');
    expect(cardLinksOf(text).map(c => c.kind)).toEqual(['preview', 'github']);
  });

  test('a plain web link is a generic preview card', () => {
    const cards = cardLinksOf('read this https://www.bbc.com/news/article-123 great piece');
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ kind: 'generic', url: 'https://www.bbc.com/news/article-123' });
  });

  test('strips trailing punctuation from a generic link url', () => {
    const cards = cardLinksOf('see (https://example.com/page).');
    expect(cards[0]).toMatchObject({ kind: 'generic', url: 'https://example.com/page' });
  });

  test('suppresses a card for an angle-bracket-wrapped generic link', () => {
    expect(cardLinksOf('look at <https://example.com/page> ok')).toEqual([]);
    expect(cardLinksOf('<https://www.bbc.com/news/article-123>')).toEqual([]);
  });

  test('suppresses a card for an angle-bracket-wrapped special link', () => {
    expect(cardLinksOf('<https://github.com/bonustrack/stage/pull/321>')).toEqual([]);
    expect(cardLinksOf('<metro://xmtp/47bf58a8f56cad829b2263797a7e25e4>')).toEqual([]);
  });

  test('mixed <bracketed> + bare link: only the bare link cards', () => {
    const text = 'hide <https://example.com/secret> but show https://github.com/bonustrack/stage';
    const cards = cardLinksOf(text);
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ kind: 'github', url: 'https://github.com/bonustrack/stage' });
  });

  test('a lone leading or trailing angle bracket does not suppress', () => {
    expect(cardLinksOf('x <https://example.com/page ok')[0]).toMatchObject({ kind: 'generic' });
    expect(cardLinksOf('x https://example.com/page> ok')[0]).toMatchObject({ kind: 'generic' });
  });

  test('generic + special links stack in order', () => {
    const text = [
      'https://github.com/bonustrack/stage',
      'https://news.ycombinator.com/item?id=1',
      'metro://xmtp/47bf58a8f56cad829b2263797a7e25e4',
    ].join(' ');
    expect(cardLinksOf(text).map(c => c.kind)).toEqual(['github', 'generic']);
  });

  test('only standalone channel links get cards, with surrounding whitespace allowed', () => {
    const conv = '47bf58a8f56cad829b2263797a7e25e4';
    const urls = [`https://stage.box/#/channel/${conv}`, `https://stage.box/channel/${conv}`, `stage://channel/${conv}`, `stage://channel/${conv}?m=abc&focus=1`];
    for (const url of urls) {
      expect(cardLinksOf(` \n\t${url}\n `)).toEqual([{ kind: 'channel', url, convId: conv }]);
      for (const text of [`join ${url}`, `join ${url}>`, `${url}\nhello`, `${url}.`, `(${url})`, `${url} ${url}`, `\`${url}\``, `\`\`\`\n${url}\n\`\`\``]) {
        expect(cardLinksOf(text)).toEqual([]);
      }
      expect(cardLinksOf(`[join](${url})`)).toEqual([{ kind: 'channel', url, convId: conv }]);
      for (const title of ['"Channel"', "'Channel'", '(Channel)']) {
        expect(cardLinksOf(`[**#Ops**](${url} ${title})`)).toEqual([{ kind: 'channel', url, convId: conv }]);
        expect(cardLinksOf(`join [#Ops](${url} ${title}) today`)).toEqual([]);
      }
      expect(cardLinksOf(`join [#Ops](${url}) today`)).toEqual([]);
    }
  });

  test('shared locations render as map cards, Google Maps and old OpenStreetMap links alike', () => {
    expect(cardLinksOf('📍 https://www.google.com/maps/search/?api=1&query=12.3456,-65.4321')[0]).toMatchObject({
      kind: 'map', lat: 12.3456, lng: -65.4321,
    });
    expect(cardLinksOf('📍 https://www.openstreetmap.org/?mlat=12.3456&mlon=-65.4321#map=16/12.3456/-65.4321')[0]).toMatchObject({
      kind: 'map', lat: 12.3456, lng: -65.4321,
    });
  });
});

const GROUP = '521df401-53f1-4413-b95a-c682dc054134';
const PROJECT = '1707f2db-c2b8-4c91-9341-27b1d57d355f';
const EXPO = `https://u.expo.dev/${PROJECT}/group/${GROUP}`;
const ENCODED = encodeURIComponent(EXPO);

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

  test('https preview-launcher on stage.box host', () => {
    const r = previewLinkOf(`https://stage.box/preview-launcher.html?u=${ENCODED}`);
    expect(r?.groupId).toBe(GROUP);
  });

  test('null for unrelated links', () => {
    expect(previewLinkOf('https://example.com/foo')).toBeNull();
    expect(previewLinkOf(null)).toBeNull();
  });
});
