/**
 * Tests for structured train errors with a retryable flag (#3).
 *
 * Covers:
 *  - shape-shared: the single-source `TrainErrorInfo`/`TrainError` is re-exported
 *    identically by `define-train` and `trains/protocol`.
 *  - TrainError round-trip: a handler that throws a `TrainError` emits BOTH the
 *    legacy `error` string AND the structured `errorInfo` on `op:response`; the
 *    daemon-side `parseTrainLine` carries `errorInfo` through; the CLI maps
 *    `errorInfo.code === 'RATE_LIMITED'` to exit code 7.
 *  - legacy-parity: a plain `Error` produces EXACTLY today's `{ error }` output
 *    (no `errorInfo` key), byte-identical to pre-#3 behaviour.
 */

import { describe, expect, test } from 'bun:test';
import {
  buildTrain, type CallMsg,
  TrainError as DTTrainError, serializeTrainError as dtSerialize,
} from '../src/define-train.ts';
import {
  TrainError, serializeTrainError, parseTrainLine,
} from '../src/trains/protocol.ts';

function harness(opts: Parameters<typeof buildTrain>[0]) {
  const lines: Record<string, unknown>[] = [];
  const t = buildTrain(opts, s => { for (const l of s.trim().split('\n')) if (l) lines.push(JSON.parse(l)); });
  return { ...t, lines };
}

describe('shape: single source', () => {
  test('define-train + protocol re-export the SAME TrainError class & serializer', () => {
    expect(DTTrainError).toBe(TrainError);
    expect(dtSerialize).toBe(serializeTrainError);
  });

  test('TrainError.toErrorInfo carries code/message/retryable/retryAfterMs', () => {
    const e = new TrainError('RATE_LIMITED', 'slow down', { retryable: true, retryAfterMs: 5000 });
    expect(e.toErrorInfo()).toEqual({
      code: 'RATE_LIMITED', message: 'slow down', retryable: true, retryAfterMs: 5000,
    });
    expect(e).toBeInstanceOf(Error); // still a real Error (legacy paths unaffected)
  });

  test('optional fields are omitted, not emitted as undefined', () => {
    const e = new TrainError('NOT_FOUND', 'gone');
    expect(e.toErrorInfo()).toEqual({ code: 'NOT_FOUND', message: 'gone' });
    expect('retryable' in e.toErrorInfo()).toBe(false);
    expect('retryAfterMs' in e.toErrorInfo()).toBe(false);
  });
});

describe('serializeTrainError', () => {
  test('TrainError → legacy string + structured errorInfo', () => {
    const body = serializeTrainError(new TrainError('RATE_LIMITED', 'busy', { retryable: true, retryAfterMs: 1234 }));
    expect(body).toEqual({
      error: 'busy',
      errorInfo: { code: 'RATE_LIMITED', message: 'busy', retryable: true, retryAfterMs: 1234 },
    });
  });

  test('plain Error → legacy string ONLY (no errorInfo)', () => {
    const body = serializeTrainError(new Error('nope'));
    expect(body).toEqual({ error: 'nope' });
    expect('errorInfo' in body).toBe(false);
  });

  test('non-Error throw → stringified legacy message only', () => {
    expect(serializeTrainError('boom')).toEqual({ error: 'boom' });
  });
});

describe('defineTrain dispatch: TrainError round-trip', () => {
  test('a thrown TrainError emits op:response with error + errorInfo', async () => {
    const h = harness({
      name: 'demo',
      actions: {
        boom: () => { throw new TrainError('RATE_LIMITED', 'rate limited', { retryable: true, retryAfterMs: 5000 }); },
      },
    });
    await h.dispatch({ op: 'call', id: 'r1', action: 'boom', args: {} } satisfies CallMsg);
    expect(h.lines[0]).toEqual({
      op: 'response', id: 'r1',
      error: 'rate limited',
      errorInfo: { code: 'RATE_LIMITED', message: 'rate limited', retryable: true, retryAfterMs: 5000 },
    });
  });

  test('legacy-parity: a plain Error emits EXACTLY { op:response, id, error } (no errorInfo key)', async () => {
    const h = harness({ name: 'demo', actions: { boom: () => { throw new Error('nope'); } } });
    await h.dispatch({ op: 'call', id: 'r2', action: 'boom', args: {} });
    // Byte-identical to pre-#3: no errorInfo key on the wire.
    expect(JSON.stringify(h.lines[0])).toBe(JSON.stringify({ op: 'response', id: 'r2', error: 'nope' }));
  });
});

describe('parseTrainLine: daemon carries errorInfo through', () => {
  test('a structured response line yields errorInfo', () => {
    const line = JSON.stringify({
      op: 'response', id: 'r1', error: 'busy',
      errorInfo: { code: 'RATE_LIMITED', message: 'busy', retryable: true, retryAfterMs: 5000 },
    });
    const msg = parseTrainLine('demo', line);
    expect(msg).toEqual({
      op: 'response', id: 'r1', result: undefined, error: 'busy',
      errorInfo: { code: 'RATE_LIMITED', message: 'busy', retryable: true, retryAfterMs: 5000 },
    });
  });

  test('a legacy error response (no errorInfo) stays errorInfo:undefined', () => {
    const msg = parseTrainLine('demo', JSON.stringify({ op: 'response', id: 'r2', error: 'nope' }));
    expect(msg).toMatchObject({ op: 'response', id: 'r2', error: 'nope' });
    expect((msg as { errorInfo?: unknown }).errorInfo).toBeUndefined();
  });

  test('malformed errorInfo (missing code/message) is dropped', () => {
    const msg = parseTrainLine('demo', JSON.stringify({
      op: 'response', id: 'r3', error: 'x', errorInfo: { retryable: true },
    }));
    expect((msg as { errorInfo?: unknown }).errorInfo).toBeUndefined();
  });
});

describe('CLI exit-code mapping (errorInfo.code preferred, regex fallback)', () => {
  // Mirrors verbs.ts codeFor() precedence without spawning the daemon.
  const EXIT = { upstream: 3, rateLimited: 7 } as const;
  type ErrLike = Error & { code?: number; errorInfo?: { code: string } };
  function codeFor(err: ErrLike): number {
    if (typeof err.code === 'number') return err.code;
    if (err.errorInfo?.code === 'RATE_LIMITED') return EXIT.rateLimited;
    if (/rate.?limit|429|too many requests/i.test(err.message)) return EXIT.rateLimited;
    return EXIT.upstream;
  }

  test('errorInfo.code RATE_LIMITED → exit 7 even when prose does not match', () => {
    const e: ErrLike = Object.assign(new Error('busy'), { errorInfo: { code: 'RATE_LIMITED' } });
    expect(codeFor(e)).toBe(EXIT.rateLimited);
  });

  test('regex fallback still catches rate limits with no errorInfo', () => {
    expect(codeFor(new Error('429 too many requests'))).toBe(EXIT.rateLimited);
  });

  test('non-rate-limited structured code → upstream 3', () => {
    const e: ErrLike = Object.assign(new Error('gone'), { errorInfo: { code: 'NOT_FOUND' } });
    expect(codeFor(e)).toBe(EXIT.upstream);
  });
});
