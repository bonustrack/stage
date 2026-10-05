import { createRequire } from 'node:module';
import { describe, expect, test } from 'bun:test';
import type { MarkdownIt } from 'react-native-markdown-display';
import { keepIndent, literalStars, messageCardLinks, taskLists, unescapeBody } from '../components/bubble/markdown.model';
import { registerDeepLinkSchemas } from '@stage-labs/client/text/markdown';
import { locationAttachment, locationText } from '../components/composer/location.model';

const createParser = createRequire(import.meta.url)('markdown-it') as (options: object) => MarkdownIt;
const md = createParser({ typographer: false, linkify: true, breaks: true })
  .use(literalStars).use(taskLists).use(keepIndent);
registerDeepLinkSchemas(md.linkify);
const cardsOf = (text: string) => messageCardLinks(text, md);
const CONV = '47bf58a8f56cad829b2263797a7e25e4';
const URLS = [
  'https://example.com/page?q=one%20two#section',
  'https://en.wikipedia.org/wiki/Function_(mathematics)',
  'http://example.com',
  `https://stage.box/#/channel/${CONV}`,
  `stage://channel/${CONV}?m=abc&focus=1`,
  `metro://xmtp/${CONV}`,
  'stage://0x42e167e6bff0a3a701d8fa14f96a0f840eb939df',
  'https://github.com/bonustrack/stage/pull/321?diff=split#discussion',
  'https://youtu.be/dQw4w9WgXcQ?t=12',
  'https://www.google.com/maps/search/?api=1&query=12.3456,-65.4321',
  'stage://expo-development-client/?url=https://u.expo.dev/project/group/build',
  'https://stage.box/preview-launcher.html?u=https%3A%2F%2Fu.expo.dev%2Fproject%2Fgroup%2Fbuild',
];

describe('card eligibility uses the existing message link parser', () => {
  test('accepts a single complete supported link with whitespace around it', () => {
    for (const url of URLS) {
      expect(cardsOf(url)).toHaveLength(1);
      expect(cardsOf(` \n\t${url}\r\n `)).toEqual(cardsOf(url));
    }
  });

  test('rejects prose, repeated links, multiple links and markdown', () => {
    for (const url of URLS) {
      for (const text of [`before ${url}`, `${url} after`, `before\n${url}`, `${url}\nafter`,
        `${url} ${url}`, `${url}\n${url}`, `${url}\t${url}`, `${url} https://example.org`,
        `${url}\nhttps://example.org`, `<${url}>`, `[docs](${url})`, `[docs](${url} "title")`,
        `\`${url}\``, `\`\`\`\n${url}\n\`\`\``, `**${url}**`, `${url}.`]) {
        expect(cardsOf(text)).toEqual([]);
      }
    }
  });

  test('rejects markdown and code attached directly to a URL', () => {
    for (const text of ['https://example.com/[other](https://example.org/)',
      'https://example.com/`inline`', 'https://example.com/**bold**',
      'https://example.com/![image](https://example.org/image.png)']) {
      expect(cardsOf(text)).toEqual([]);
    }
  });

  test('uses the same escaped whitespace as the displayed body', () => {
    const url = 'https://example.com/page';
    for (const separator of ['\\n', '\\r', '\\t', '\\r\\n']) {
      expect(cardsOf(`${url}${separator}Hello`)).toEqual([]);
      expect(cardsOf(`${url}${separator}${url}`)).toEqual([]);
      expect(cardsOf(`${url}${separator}https://example.org/`)).toEqual([]);
      for (const supported of URLS) {
        expect(cardsOf(`${separator}${supported}${separator}`)).toEqual(cardsOf(supported));
      }
    }
    const text = `${url}\\nhttps://example.org/`;
    const links = md.parseInline(unescapeBody(text), {}).flatMap(token => token.children ?? [])
      .filter(token => token.type === 'link_open').map(token => token.attrGet('href'));
    expect(links).toEqual([url, 'https://example.org/']);
    expect(unescapeBody('`keep\\ncode`')).toBe('`keep\\ncode`');
    expect(cardsOf(`${url}\\n\`inline\``)).toEqual([]);
  });

  test('rejects malformed URLs, nonlinks and unsupported schemes', () => {
    for (const text of ['', 'text', 'https://', 'https://?', 'https://#', 'https://[broken',
      'https://exa mple.com', 'https://example.com:bad/path', 'example.com', 'mailto:a@example.com',
      'ftp://example.com', 'javascript:alert(1)', 'stage://unknown']) {
      expect(cardsOf(text)).toEqual([]);
    }
  });

  test('keeps both links clickable in the screenshot reproduction without cards', () => {
    const links = ['https://docs.xmtp.org/chat-apps/core-messaging/group-permissions',
      'https://docs.xmtp.org/chat-apps/core-messaging/group-metadata'];
    const text = `Final check confirms this. Nothing changed yet.\n${links.join('\n')}`;
    expect(cardsOf(text)).toEqual([]);
    const destinations = md.parseInline(text, {}).flatMap(token => token.children ?? [])
      .filter(token => token.type === 'link_open').map(token => token.attrGet('href'));
    expect(destinations).toEqual(links);
  });

  test('only bare location URLs get map cards, not the composer pin-prefixed text', () => {
    for (const [lat, lng] of [[12.3456, -65.4321], [-45, 170], [0.0000001, -0.0000002], [89.9999999, -179.9999999]] as const) {
      const location = locationAttachment(lat, lng, 'loc');
      expect(cardsOf(location.url)).toMatchObject([{ kind: 'map', lat, lng }]);
      expect(cardsOf(locationText(location))).toEqual([]);
      expect(md.renderInline(locationText(location))).toContain(`href="${location.url.replace(/&/g, '&amp;')}"`);
    }
  });
});
