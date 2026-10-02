import { describe, expect, test } from 'bun:test';
import { channelRefToken } from '../src/xmtp/channelRefs';
import {
  bodySegments, bodyView, mentionAddresses, mentionLabel, namedPlainText, withMentionLabels, type LinkFinder,
} from '../src/xmtp/messageBody';

const A = '0x59445094f08d01213bd6ba7215a6ab7a4bc29a4a';
const B = '0x6f53196a053da13a1cced1115d104ae5e4c4bc06';
const OPS = channelRefToken('c0ffee02', 'Ops');
const findLinks: LinkFinder = text => [...text.matchAll(/(?:https?:\/\/|stage:\/\/|metro:\/\/)\S+/g)].map(m => (
  { index: m.index, lastIndex: m.index + m[0].length, url: m[0] }
));

describe('mention labels', () => {
  test('prefixes a name with a single @', () => {
    expect(mentionLabel('Chen')).toBe('@Chen');
    expect(mentionLabel('@chen123')).toBe('@chen123');
  });

  test('lists the mentioned addresses in order', () => {
    expect(mentionAddresses(`added @${A} and @${B.toUpperCase().replace('0X', '0x')}`)).toEqual([A, B]);
    expect(mentionAddresses('added 2 members')).toEqual([]);
  });

  test('replaces every mention with its label and keeps the text around it', () => {
    const names: Record<string, string> = { [A]: '@chen', [B]: '@tony' };
    expect(withMentionLabels(`added @${A} and @${B}`, a => names[a] ?? a)).toBe('added @chen and @tony');
    expect(withMentionLabels('hello', a => a)).toBe('hello');
  });

  test('shows names in plain views of a body that mentions someone', () => {
    expect(bodyView(`added @${A}`, true)).toBe('namedPlain');
    expect(bodyView('added 2 members', true)).toBe('plain');
    expect(bodyView(`added @${A}`, false)).toBe('mention');
    expect(bodyView('**hello**', false)).toBe('markdown');
  });

  test('shows a channel ref as its hash label in plain views', () => {
    expect(withMentionLabels(`join ${OPS} with @${A}`, () => '@chen')).toBe('join #Ops with @chen');
  });

  test('renders a body with a channel ref as links, not markdown', () => {
    expect(bodyView(`join ${OPS}`, false)).toBe('mention');
    expect(bodyView(`join ${OPS}`, true)).toBe('namedPlain');
  });

  test('splits a body into text, channel and mention segments', () => {
    expect(bodySegments(`join ${OPS} with @${A}!`, findLinks)).toEqual([
      { type: 'text', text: 'join ' },
      { type: 'channel', convId: 'c0ffee02', label: 'Ops' },
      { type: 'text', text: ' with ' },
      { type: 'mention', address: A },
      { type: 'text', text: '!' },
    ]);
  });

  test('turns web links into link segments next to mentions and channels', () => {
    expect(bodySegments(`test @${A} https://stage.box ${OPS}`, findLinks)).toEqual([
      { type: 'text', text: 'test ' },
      { type: 'mention', address: A },
      { type: 'text', text: ' ' },
      { type: 'link', url: 'https://stage.box', text: 'https://stage.box' },
      { type: 'text', text: ' ' },
      { type: 'channel', convId: 'c0ffee02', label: 'Ops' },
    ]);
  });

  test('turns markdown links into link segments with their label', () => {
    expect(bodySegments(`[the docs](https://example.com/a_(b)) for @${A}`, findLinks)).toEqual([
      { type: 'link', url: 'https://example.com/a_(b)', text: 'the docs' },
      { type: 'text', text: ' for ' },
      { type: 'mention', address: A },
    ]);
  });

  test('uses channel segments for URL forms beside text and mentions, retaining routes', () => {
    const url = 'stage://channel/c0ffee02?m=123&focus=1';
    expect(bodySegments(`join ${url} with @${A}`, findLinks)).toEqual([
      { type: 'text', text: 'join ' }, { type: 'channel', convId: 'c0ffee02', url },
      { type: 'text', text: ' with ' }, { type: 'mention', address: A },
    ]);
    expect(bodySegments(`[Join here](${url})`, findLinks)).toEqual([{ type: 'channel', convId: 'c0ffee02', url, text: 'Join here' }]);
    expect(bodySegments(`[#Ops](${url})`, findLinks)).toEqual([{ type: 'channel', convId: 'c0ffee02', url, text: '#Ops', label: 'Ops' }]);
    expect(bodyView(url, true, findLinks)).toBe('namedPlain');
    expect(bodyView(`**join** ${url}`, false, findLinks)).toBe('markdown');
  });

  test('keeps punctuation, profile URLs and code separate from channel links', () => {
    const url = 'stage://channel/c0ffee02';
    expect(bodySegments(`${url}.`, findLinks)).toEqual([
      { type: 'channel', convId: 'c0ffee02', url }, { type: 'text', text: '.' },
    ]);
    expect(bodySegments(`\`${url}\``, findLinks)).toEqual([{ type: 'text', text: `\`${url}\``, literal: true }]);
    const profile = `https://stage.box/user/${A}`;
    expect(bodySegments(profile, findLinks)).toEqual([{ type: 'link', url: profile, text: profile }]);
    expect(bodySegments(`\`${OPS}\``, findLinks)).toEqual([{ type: 'text', text: `\`${OPS}\``, literal: true }]);
  });

  test('protects matching backtick runs and ignores code-only mentions when choosing a view', () => {
    const url = 'stage://channel/c0ffee02';
    for (const run of ['`', '``', '```', '````']) {
      const code = `${run}${url} @${A}${run}`;
      expect(bodySegments(code, findLinks)).toEqual([{ type: 'text', text: code, literal: true }]);
      expect(bodyView(`**read** ${code}`, false, findLinks)).toBe('markdown');
      expect(bodyView(code, true, findLinks)).toBe('plain');
      expect(bodySegments(`${code} @${B}`, findLinks).filter(s => s.type === 'mention')).toEqual([{ type: 'mention', address: B }]);
    }
  });

  test('plain views retain ordinary Markdown URLs and resolve mentions within their labels', () => {
    const source = `read [ping @${A}](https://example.com) today stage://channel/c0ffee02`;
    const result = namedPlainText(bodySegments(source, findLinks, true), () => '@Chen', () => '#Ops');
    expect(result).toBe('read [ping @Chen](https://example.com) today #Ops');
    expect(bodyView(`[ping @${A}](https://example.com)`, true, findLinks)).toBe('namedPlain');
    expect(namedPlainText(bodySegments(`code \`@${A}\` and @${B}`, findLinks, true), () => '@Chen', () => '#Ops'))
      .toBe(`code \`@${A}\` and @Chen`);
  });

  test('channel fallbacks work in formatted Markdown links with titles', () => {
    const url = 'stage://channel/c0ffee02';
    expect(bodySegments(`[**#Ops**](${url} "Channel")`, findLinks)).toEqual([
      { type: 'channel', convId: 'c0ffee02', url, text: '**#Ops**', label: 'Ops' },
    ]);
  });

  test('keeps a markdown link to a non web target as text', () => {
    expect(bodySegments(`[x](javascript:alert) @${A}`, findLinks)).toEqual([
      { type: 'text', text: '[x](javascript:alert) ' },
      { type: 'mention', address: A },
    ]);
  });
});
