
import { describe, expect, test } from 'bun:test';
import {
  parseMentions,
  hasMention,
  matchMembers,
  computeMentionQuery,
  MENTION_RE,
} from '../src/xmtp/mentions';

const A = '0x42e167e6bff0a3a701d8fa14f96a0f840eb939df';
const B = '0xabc0000000000000000000000000000000000def';

describe('hasMention', () => {
  test('detects a valid mention and ignores non-address @ tokens', () => {
    expect(hasMention(`hi @${A}`)).toBe(true);
    expect(hasMention('hi @alice')).toBe(false);
    expect(hasMention('no mention here')).toBe(false);
  });
});

describe('parseMentions', () => {
  test('splits leading/trailing text around a single mention', () => {
    expect(parseMentions(`hey @${A} there`)).toEqual([
      { type: 'text', text: 'hey ' },
      { type: 'mention', address: A },
      { type: 'text', text: ' there' },
    ]);
  });

  test('handles back-to-back mentions and uppercase hex digits', () => {
    const aUpper = '0x' + A.slice(2).toUpperCase();
    expect(parseMentions(`@${aUpper} @${B}`)).toEqual([
      { type: 'mention', address: A },
      { type: 'text', text: ' ' },
      { type: 'mention', address: B },
    ]);
  });

  test('plain text yields a single text segment', () => {
    expect(parseMentions('just text')).toEqual([{ type: 'text', text: 'just text' }]);
  });

  test('is stateless across calls despite the global regex', () => {
    const body = `x @${A} y`;
    expect(parseMentions(body)).toEqual(parseMentions(body));
    expect(MENTION_RE.lastIndex).toBe(0);
  });
});

describe('matchMembers', () => {
  const members = [
    { address: A, name: 'Alice' },
    { address: B, name: 'Bob' },
  ];

  test('empty query returns all (capped by limit)', () => {
    expect(matchMembers(members, '')).toHaveLength(2);
    expect(matchMembers(members, '', 1)).toHaveLength(1);
  });

  test('matches on name substring case-insensitively', () => {
    expect(matchMembers(members, 'ali')).toEqual([members[0]]);
  });

  test('matches on address substring', () => {
    expect(matchMembers(members, 'abc0')).toEqual([members[1]]);
  });

  test('ranks a name that starts with the query before other matches', () => {
    const hex = (d: string): string => `0x${d.repeat(40)}`;
    const ranked = [
      { address: hex('d'), name: '0xdddd…dddd' },
      { address: hex('e'), name: 'Eddie' },
      { address: hex('1'), name: 'Ann Dee' },
      { address: hex('2'), name: 'dana.stage.eth' },
    ];
    expect(matchMembers(ranked, 'd').map(m => m.name)).toEqual(['Ann Dee', 'dana.stage.eth', '0xdddd…dddd', 'Eddie']);
  });

  test('keeps a name match when address matches fill the limit', () => {
    const crowd = [...'0123456'].map(d => ({ address: `0x${d.repeat(39)}d`, name: `user ${d}` }));
    const dana = { address: A, name: 'Dana' };
    expect(matchMembers([...crowd, dana], 'd')[0]).toEqual(dana);
  });
});

describe('computeMentionQuery', () => {
  const members = [{ address: A, name: 'Alice' }];

  test('opens a range when the caret is in an @query token', () => {
    const text = 'hi @al';
    const res = computeMentionQuery(text, text.length, members);
    expect(res.range).toEqual({ start: 3, end: 6 });
    expect(res.matches).toEqual(members);
  });

  test('no range when there is no @ token before the caret', () => {
    expect(computeMentionQuery('hello world', 11, members).range).toBeNull();
  });

  test('no range without candidates', () => {
    expect(computeMentionQuery('hi @a', 5, undefined).range).toBeNull();
  });
});
