/**
 * Unit tests for `trainEventToHistoryEntry` (src/dispatcher/server.ts) — the
 * snake_case wire → camelCase `HistoryEntry` translation every train event
 * flows through.
 *
 * Covers: required `line` (drop when missing/non-string), default-filling for
 * id/ts/station/from/to, the `is_private` → `to = userSelf()` branch, the
 * `emoji` → text fold, and verbatim passthrough of payload / *_name / ids.
 *
 * In-process; METRO_STATE_DIR is sandboxed by the test runner. METRO_FROM is
 * pinned so `userSelf()` is deterministic (no host autodetect).
 */

import { describe, expect, test, beforeAll } from 'bun:test';
import type { TrainEvent } from '../src/trains/protocol.ts';

let trainEventToHistoryEntry: typeof import('../src/dispatcher/server.ts').trainEventToHistoryEntry;

beforeAll(async () => {
  /** Pin self so the is_private default is deterministic and no host autodetect runs. */
  process.env.METRO_FROM = 'metro://user/me';
  ({ trainEventToHistoryEntry } = await import('../src/dispatcher/server.ts'));
});

describe('trainEventToHistoryEntry — required line', () => {
  test('drops event without a `line` (returns null)', () => {
    expect(trainEventToHistoryEntry({} as TrainEvent, 'tg')).toBeNull();
  });

  test('drops event with non-string `line`', () => {
    expect(trainEventToHistoryEntry({ line: 123 as unknown as string }, 'tg')).toBeNull();
  });
});

describe('trainEventToHistoryEntry — defaults for omitted fields', () => {
  test('mints id when absent', () => {
    const e = trainEventToHistoryEntry({ line: 'metro://discord/1', id: undefined }, 'discord');
    expect(e).not.toBeNull();
    expect(typeof e!.id).toBe('string');
    expect(e!.id).toMatch(/^msg_/);
  });

  test('preserves a train-supplied id', () => {
    const e = trainEventToHistoryEntry({ line: 'metro://discord/1', id: 'fixed-id' }, 'discord');
    expect(e!.id).toBe('fixed-id');
  });

  test('fills ts with an ISO timestamp when absent', () => {
    const e = trainEventToHistoryEntry({ line: 'metro://discord/1' }, 'discord');
    expect(() => new Date(e!.ts).toISOString()).not.toThrow();
    expect(new Date(e!.ts).toISOString()).toBe(e!.ts);
  });

  test('preserves a train-supplied ts', () => {
    const e = trainEventToHistoryEntry({ line: 'metro://discord/1', ts: '2026-01-02T03:04:05.000Z' }, 'discord');
    expect(e!.ts).toBe('2026-01-02T03:04:05.000Z');
  });

  test('station: explicit env.station wins', () => {
    const e = trainEventToHistoryEntry({ line: 'metro://discord/1', station: 'custom' }, 'tg');
    expect(e!.station).toBe('custom');
  });

  test('station: derived from line when env.station absent', () => {
    const e = trainEventToHistoryEntry({ line: 'metro://telegram/123' }, 'fallback-name');
    expect(e!.station).toBe('telegram');
  });

  test('station: falls back to trainName when line has no parseable station', () => {
    /** "not-a-line" is not metro:// → Line.station() is null → trainName. */
    const e = trainEventToHistoryEntry({ line: 'not-a-line' }, 'my-train');
    expect(e!.station).toBe('my-train');
  });

  test('from: defaults to metro://<station> when absent', () => {
    const e = trainEventToHistoryEntry({ line: 'metro://telegram/123' }, 'tg');
    expect(e!.from).toBe('metro://telegram');
  });

  test('from: preserves explicit value', () => {
    const e = trainEventToHistoryEntry({ line: 'metro://telegram/123', from: 'metro://telegram/user/bob' }, 'tg');
    expect(e!.from).toBe('metro://telegram/user/bob');
  });
});

describe('trainEventToHistoryEntry — to / is_private default', () => {
  test('to defaults to the line itself (public)', () => {
    const e = trainEventToHistoryEntry({ line: 'metro://discord/1' }, 'discord');
    expect(e!.to).toBe('metro://discord/1' as typeof e.to);
  });

  test('is_private:true routes `to` to userSelf()', () => {
    const e = trainEventToHistoryEntry({ line: 'metro://discord/1', is_private: true }, 'discord');
    expect(e!.to).toBe('metro://user/me' as typeof e.to);
  });

  test('explicit `to` wins over is_private', () => {
    const e = trainEventToHistoryEntry({ line: 'metro://discord/1', is_private: true, to: 'metro://discord/u/x' }, 'discord');
    expect(e!.to).toBe('metro://discord/u/x' as typeof e.to);
  });

  test('is_private only triggers on strict true (truthy non-true ignored)', () => {
    const e = trainEventToHistoryEntry({ line: 'metro://discord/1', is_private: 1 as unknown as boolean }, 'discord');
    /** is_private !== true → public default → to === line. */
    expect(e!.to).toBe('metro://discord/1' as typeof e.to);
  });
});

describe('trainEventToHistoryEntry — text / emoji fold', () => {
  test('text passes through verbatim', () => {
    const e = trainEventToHistoryEntry({ line: 'metro://discord/1', text: 'hello' }, 'discord');
    expect(e!.text).toBe('hello');
  });

  test('emoji folds into a [react …] text when text is absent', () => {
    const e = trainEventToHistoryEntry({ line: 'metro://discord/1', emoji: '👍' }, 'discord');
    expect(e!.text).toBe('[react 👍]');
  });

  test('explicit text wins over emoji', () => {
    const e = trainEventToHistoryEntry({ line: 'metro://discord/1', text: 'kept', emoji: '👍' }, 'discord');
    expect(e!.text).toBe('kept');
  });

  test('text undefined when neither text nor emoji', () => {
    const e = trainEventToHistoryEntry({ line: 'metro://discord/1' }, 'discord');
    expect(e!.text).toBeUndefined();
  });
});

describe('trainEventToHistoryEntry — passthrough fields', () => {
  test('payload / *_name / message_id / reply_to map to camelCase', () => {
    const payload = { headers: { a: '1' }, body: { ok: true } };
    const e = trainEventToHistoryEntry({
      line: 'metro://telegram/123',
      line_name: 'My Group',
      from: 'metro://telegram/user/bob',
      from_name: 'Bob',
      message_id: 'mid-7',
      reply_to: 'mid-3',
      payload,
    }, 'tg');
    expect(e!.lineName).toBe('My Group');
    expect(e!.fromName).toBe('Bob');
    expect(e!.messageId).toBe('mid-7');
    expect(e!.replyTo).toBe('mid-3');
    expect(e!.payload).toEqual(payload);
    /** payload is passed by reference, not deep-copied. */
    expect(e!.payload).toBe(payload);
  });

  test('optional camelCase fields are undefined when wire fields absent', () => {
    const e = trainEventToHistoryEntry({ line: 'metro://discord/1' }, 'discord');
    expect(e!.lineName).toBeUndefined();
    expect(e!.fromName).toBeUndefined();
    expect(e!.messageId).toBeUndefined();
    expect(e!.replyTo).toBeUndefined();
    expect(e!.payload).toBeUndefined();
  });
});
