/** Boundary tests for the JSON codec wire round-trip + the optional zod schema
 *  guard on decode. These are the seam every Metro custom content type crosses;
 *  a regression here silently corrupts every poll / signature / tx bubble. */

import { describe, expect, test } from 'bun:test';
import { encodeJsonContent, decodeJsonContent, POLL_CONTENT_TYPE } from '../src/xmtp/codecs';
import { pollContentSchema } from '../src/xmtp/poll.schema';
import type { PollContent } from '../src/xmtp/poll';

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
