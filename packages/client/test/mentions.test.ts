/** Tests for the shared @mention parser. The wire format is a bare `@0x<40 hex>`
 *  token (an `@` directly followed by a full lowercase ETH address); web and
 *  mobile both encode/decode through these helpers so mentions interop. Covers
 *  body → segments parsing, mention formatting, member prefix/substring matching,
 *  and caret-driven query/insertion in the composer. */

import { describe, expect, test } from 'bun:test';
import {
  parseMentions,
  formatMention,
  hasMention,
  matchMembers,
  computeMentionQuery,
  applyMention,
  MENTION_RE,
} from '../src/xmtp/mentions';

const A = '0x42e167e6bff0a3a701d8fa14f96a0f840eb939df';
const B = '0xabc0000000000000000000000000000000000def';

describe('formatMention', () => {
  test('lowercases the address and appends a trailing space', () => {
    expect(formatMention(A.toUpperCase())).toBe(`@${A} `);
  });
});

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

describe('applyMention', () => {
  test('replaces the @query range with the encoded mention and returns the caret', () => {
    const text = 'hi @al rest';
    const { next, cursor } = applyMention(text, { start: 3, end: 6 }, A);
    expect(next).toBe(`hi @${A}  rest`);
    expect(next.slice(0, cursor)).toBe(`hi @${A} `);
  });

  test('round-trips through parseMentions', () => {
    const { next } = applyMention('@al', { start: 0, end: 3 }, A);
    expect(parseMentions(next.trim())).toEqual([{ type: 'mention', address: A }]);
  });
});
