/** Boundary tests for the JSON codec wire round-trip + the optional zod schema
 *  guard on decode. These are the seam every Metro custom content type crosses;
 *  a regression here silently corrupts every poll / signature / tx bubble. */

import { describe, expect, test } from 'bun:test';
import {
  encodeJsonContent, decodeJsonContent, POLL_CONTENT_TYPE,
  EDIT_CONTENT_TYPE, UNSEND_CONTENT_TYPE,
} from '../src/xmtp/codecs';
import {
  type EditContent, type UnsendContent, editFallbackText, unsendFallbackText,
} from '../src/xmtp/edit';
import { pollContentSchema } from '../src/xmtp/poll.schema';
import {
  normalizeQuestions, openVoteKey, parseOpenVote, openAnswersByPoll,
  parseVoteKey, type PollContent, type VoteEvent,
} from '../src/xmtp/poll';

const poll: PollContent = {
  pollId: 'poll_abc',
  question: 'Ship it?',
  options: [{ label: 'Yes' }, { label: 'No' }],
};

describe('encode/decode JSON content round-trip', () => {
  test('content survives a UTF-8 JSON round-trip', () => {
    const enc = encodeJsonContent(POLL_CONTENT_TYPE, poll, 'fallback');
    expect(enc.content).toBeInstanceOf(Uint8Array);
    expect(decodeJsonContent<PollContent>(enc.content)).toEqual(poll);
  });

  test('unicode payloads survive', () => {
    const p = { ...poll, question: 'Ship it? 🚀 café' };
    const enc = encodeJsonContent(POLL_CONTENT_TYPE, p);
    expect(decodeJsonContent<typeof p>(enc.content)).toEqual(p);
  });
});

describe('decode with zod schema boundary', () => {
  test('valid body validates + returns typed content', () => {
    const enc = encodeJsonContent(POLL_CONTENT_TYPE, poll);
    expect(decodeJsonContent(enc.content, pollContentSchema)).toEqual(poll);
  });

  test('drifted body THROWS (not silently cast)', () => {
    // A poll missing `options` is wire drift; without the schema this would be
    // an `as PollContent` cast handing the renderer a broken object.
    const bad = encodeJsonContent(POLL_CONTENT_TYPE, { pollId: 'x', question: 'q' });
    expect(() => decodeJsonContent(bad.content, pollContentSchema)).toThrow(/boundary:xmtp.codec/);
  });

  test('only-one-option poll is rejected (>= 2 required)', () => {
    const bad = encodeJsonContent(POLL_CONTENT_TYPE, { pollId: 'x', question: 'q', options: [{ label: 'a' }] });
    expect(() => decodeJsonContent(bad.content, pollContentSchema)).toThrow();
  });
});

describe('open (free-text) question type', () => {
  test('schema accepts a pure free-text question (no options)', () => {
    const open: PollContent = { pollId: 'p', questions: [{ question: 'Why?', open: true, options: [] }] };
    const enc = encodeJsonContent(POLL_CONTENT_TYPE, open);
    expect(decodeJsonContent(enc.content, pollContentSchema)).toEqual(open);
  });

  test('schema accepts options + open together (pick or type your own)', () => {
    const mixed: PollContent = { pollId: 'p', questions: [{ question: 'Pick', open: true, options: [{ label: 'a' }, { label: 'b' }] }] };
    const enc = encodeJsonContent(POLL_CONTENT_TYPE, mixed);
    expect(decodeJsonContent(enc.content, pollContentSchema)).toEqual(mixed);
  });

  test('a non-open question with <2 options still throws', () => {
    const bad = encodeJsonContent(POLL_CONTENT_TYPE, { pollId: 'p', questions: [{ question: 'q', options: [{ label: 'a' }] }] });
    expect(() => decodeJsonContent(bad.content, pollContentSchema)).toThrow();
  });

  test('normalizeQuestions keeps an open question with no options + carries the flag', () => {
    const qs = normalizeQuestions({ pollId: 'p', questions: [{ question: 'Why?', open: true, options: [] }] });
    expect(qs).toHaveLength(1);
    expect(qs[0].open).toBe(true);
    expect(qs[0].options).toEqual([]);
  });

  test('open vote key round-trips text containing colons + unicode', () => {
    const text = 'edge: 1:2:3 café 🚀';
    const key = openVoteKey(2, text);
    expect(parseOpenVote(key)).toEqual({ q: 2, text });
    // An open key must NOT decode as a choice vote (distinct namespaces).
    expect(parseVoteKey(key)).toBeNull();
  });

  test('openAnswersByPoll: latest per voter wins; removal clears', () => {
    const evs: VoteEvent[] = [
      { reference: 'm', schema: 'custom', voter: 'a', ts: '1', content: openVoteKey(0, 'first') },
      { reference: 'm', schema: 'custom', voter: 'a', ts: '2', content: openVoteKey(0, 'second') },
      { reference: 'm', schema: 'custom', voter: 'b', ts: '1', content: openVoteKey(0, 'keep') },
      { reference: 'm', schema: 'custom', voter: 'b', ts: '2', removed: true, content: openVoteKey(0, '') },
    ];
    const out = openAnswersByPoll(evs, 'm', 0);
    expect(out.get('a')?.text).toBe('second');
    expect(out.has('b')).toBe(false);
  });
});

describe('edit / unsend content types', () => {
  test('edit body round-trips + fallback is the new text', () => {
    const edit: EditContent = { messageId: 'orig-1', text: 'fixed typo 🚀' };
    const enc = encodeJsonContent(EDIT_CONTENT_TYPE, edit, editFallbackText(edit));
    expect(decodeJsonContent<EditContent>(enc.content)).toEqual(edit);
    expect(enc.fallback).toBe('fixed typo 🚀');
  });

  test('unsend body round-trips + fallback is the tombstone string', () => {
    const un: UnsendContent = { messageId: 'orig-2' };
    const enc = encodeJsonContent(UNSEND_CONTENT_TYPE, un, unsendFallbackText(un));
    expect(decodeJsonContent<UnsendContent>(enc.content)).toEqual(un);
    expect(enc.fallback).toBe('Message deleted');
  });
});
