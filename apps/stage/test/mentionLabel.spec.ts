import { describe, expect, test } from 'bun:test';
import { channelRefToken } from '@stage-labs/client/xmtp/channelRefs';
import {
  bodySegments, bodyView, mentionAddresses, mentionLabel, withMentionLabels, type LinkFinder,
} from '../components/bubble/mention.model';

const A = '0x59445094f08d01213bd6ba7215a6ab7a4bc29a4a';
const B = '0x6f53196a053da13a1cced1115d104ae5e4c4bc06';
const OPS = channelRefToken('c0ffee02', 'Ops');
const findLinks: LinkFinder = text => [...text.matchAll(/https?:\/\/\S+/g)].map(m => (
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

  test('keeps a markdown link to a non web target as text', () => {
    expect(bodySegments(`[x](javascript:alert) @${A}`, findLinks)).toEqual([
      { type: 'text', text: '[x](javascript:alert) ' },
      { type: 'mention', address: A },
    ]);
  });
});
