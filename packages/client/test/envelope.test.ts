
import { describe, expect, test } from 'bun:test';
import { mapDecodedToEnvelope } from '../src/xmtp/envelope';
import {
  textMessage, reactionMessage, voteReaction, throwingCodec,
} from './fixtures/decoded-messages';

const LINE = 'metro://xmtp/tony/conv1';

describe('mapDecodedToEnvelope', () => {
  test('plain text maps to a text entry with xmtp station + user-prefixed from', () => {
    const e = mapDecodedToEnvelope(textMessage, LINE);
    expect(e.station).toBe('xmtp');
    expect(e.line).toBe(LINE);
    expect(e.text).toBe('hello world');
    expect(e.from).toContain('inbox-alice');
    expect(e.payload?.contentType).toBe('text');
    expect(typeof e.ts).toBe('string');
    expect(e.ts).toContain('2024');
  });

  test('unicode reaction surfaces emoji + reactTo, not a vote', () => {
    const e = mapDecodedToEnvelope(reactionMessage, LINE);
    expect(e.payload?.emoji).toBe('👍');
    expect(e.payload?.reactTo).toBe('msg-text-1');
    expect(e.payload?.schema).toBeUndefined();
  });

  test('custom-schema reaction is decoded as a poll VOTE', () => {
    const e = mapDecodedToEnvelope(voteReaction, LINE);
    expect(e.payload?.schema).toBe('custom');
    expect(e.payload?.voteFor).toBe('poll-msg-1');
    expect(e.payload?.optionIndex).toBe(1);
  });

  test('unavailable codec degrades to fallback - does NOT throw', () => {
    let e: ReturnType<typeof mapDecodedToEnvelope> | undefined;
    expect(() => { e = mapDecodedToEnvelope(throwingCodec, LINE); }).not.toThrow();
    expect(e?.text).toContain('somethingNew');
    expect(e?.payload?.contentType).toBe('somethingNew');
  });
});
