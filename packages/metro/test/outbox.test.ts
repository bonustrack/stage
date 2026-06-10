/**
 * Tests for the durable outbox (src/outbox.ts) + driver (src/outbox-driver.ts):
 *   - append + state transitions (pending → sent / failed / dead)
 *   - retryable vs terminal classification (string + errorInfo.retryable)
 *   - restart-replay conservatism (only attempts===0 entries replay)
 *   - driver: MUTATE calls journal + retry; READ calls pass through untouched
 *   - legacy parity: with the file idle/absent, dispatch is byte-identical
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  Outbox, isRetryable, mintIdempotencyKey, MAX_ATTEMPTS, RETRY_BACKOFFS_MS,
  type OutboxEntry,
} from '../src/outbox.ts';
import { OutboxDriver, isMutateCall } from '../src/outbox-driver.ts';
import type { TrainCallResponse } from '../src/trains/protocol.ts';

let dir: string;
let file: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'outbox-')); file = join(dir, 'outbox.jsonl'); });
afterEach(() => { try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ } });

const flush = (): Promise<void> => new Promise(r => setTimeout(r, 0));

describe('isRetryable classification', () => {
  test('errorInfo.retryable wins over the string', () => {
    expect(isRetryable('some transient blip', { retryable: false })).toBe(false);
    expect(isRetryable('invalid args', { retryable: true })).toBe(true);
  });
  test('terminal error strings are not retryable', () => {
    for (const e of ['invalid line', 'unsupported verb', 'not found', 'unauthorized', 'bad request', 'malformed']) {
      expect(isRetryable(e, undefined)).toBe(false);
    }
  });
  test('transient / unknown errors are retryable', () => {
    expect(isRetryable('timed out after 60000ms', undefined)).toBe(true);
    expect(isRetryable('ECONNRESET', undefined)).toBe(true);
    expect(isRetryable(undefined, undefined)).toBe(true);
  });
});

describe('Outbox journal: append + transitions', () => {
  test('enqueue writes a pending entry and persists it', () => {
    const o = new Outbox(file);
    const e = o.enqueue('idem_1', 'xmtp', 'send', { line: 'x', text: 'hi' });
    expect(e.state).toBe('pending');
    expect(e.attempts).toBe(0);
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file, 'utf8')).toContain('idem_1');
  });

  test('markAttempt → markSent transitions to sent', () => {
    const o = new Outbox(file);
    const e = o.enqueue('k', 'discord', 'send', {});
    o.markAttempt(e.outboxId);
    o.markSent(e.outboxId);
    expect(o.get(e.outboxId)?.state).toBe('sent');
    expect(o.get(e.outboxId)?.attempts).toBe(1);
  });

  test('retryable failure with attempts left → failed + a backoff', () => {
    const o = new Outbox(file);
    const e = o.enqueue('k', 'xmtp', 'send', {});
    o.markAttempt(e.outboxId);
    const backoff = o.markFailed(e.outboxId, 'timed out', undefined);
    expect(backoff).toBe(RETRY_BACKOFFS_MS[0]);
    expect(o.get(e.outboxId)?.state).toBe('failed');
  });

  test('terminal error → dead immediately (no backoff)', () => {
    const o = new Outbox(file);
    const e = o.enqueue('k', 'xmtp', 'send', {});
    o.markAttempt(e.outboxId);
    const backoff = o.markFailed(e.outboxId, 'invalid line', { retryable: false });
    expect(backoff).toBe(null);
    expect(o.get(e.outboxId)?.state).toBe('dead');
  });

  test('retryable failures dead-letter once the attempt cap is reached', () => {
    const o = new Outbox(file);
    const e = o.enqueue('k', 'xmtp', 'send', {});
    let backoff: number | null = 0;
    for (let i = 0; i < MAX_ATTEMPTS; i++) { o.markAttempt(e.outboxId); backoff = o.markFailed(e.outboxId, 'timeout', undefined); }
    expect(backoff).toBe(null);
    expect(o.get(e.outboxId)?.state).toBe('dead');
    expect(o.get(e.outboxId)?.attempts).toBe(MAX_ATTEMPTS);
  });

  test('list filters by state and honors limit', () => {
    const o = new Outbox(file);
    const a = o.enqueue('1', 'xmtp', 'send', {}); o.markAttempt(a.outboxId); o.markSent(a.outboxId);
    const b = o.enqueue('2', 'xmtp', 'send', {}); o.markAttempt(b.outboxId); o.markFailed(b.outboxId, 'invalid', { retryable: false });
    expect(o.list({ state: 'sent' }).map(e => e.outboxId)).toEqual([a.outboxId]);
    expect(o.list({ state: 'dead' }).map(e => e.outboxId)).toEqual([b.outboxId]);
    expect(o.list({ limit: 1 }).length).toBe(1);
  });

  test('reload from disk reflects the latest line-per-entry state', () => {
    const o1 = new Outbox(file);
    const e = o1.enqueue('k', 'xmtp', 'send', {});
    o1.markAttempt(e.outboxId); o1.markSent(e.outboxId);
    const o2 = new Outbox(file); // fresh index, same file
    expect(o2.get(e.outboxId)?.state).toBe('sent');
  });

  test('requeue resets a dead entry to pending with attempts 0', () => {
    const o = new Outbox(file);
    const e = o.enqueue('k', 'xmtp', 'send', {});
    o.markAttempt(e.outboxId); o.markFailed(e.outboxId, 'invalid', { retryable: false });
    const r = o.requeue(e.outboxId);
    expect(r?.state).toBe('pending');
    expect(r?.attempts).toBe(0);
  });
});

describe('restart-replay conservatism', () => {
  test('only never-dispatched (attempts===0) pending entries replay', () => {
    const o = new Outbox(file);
    const never = o.enqueue('never', 'xmtp', 'send', {});           // attempts 0, pending
    const inflight = o.enqueue('inflight', 'xmtp', 'send', {});      // dispatched, response lost
    o.markAttempt(inflight.outboxId);                                // attempts 1, still pending
    const sent = o.enqueue('sent', 'xmtp', 'send', {});
    o.markAttempt(sent.outboxId); o.markSent(sent.outboxId);
    const ids = o.pendingForReplay().map((e: OutboxEntry) => e.outboxId);
    expect(ids).toContain(never.outboxId);
    expect(ids).not.toContain(inflight.outboxId); // would double-send w/o train dedup
    expect(ids).not.toContain(sent.outboxId);
  });
});

describe('OutboxDriver', () => {
  test('isMutateCall: send is mutate, accounts is read, unknown trains are not mutate', () => {
    expect(isMutateCall('xmtp', 'send')).toBe(true);
    expect(isMutateCall('xmtp', 'accounts')).toBe(false);
    expect(isMutateCall('mystery', 'send')).toBe(false);
  });

  test('READ call passes through and is never journaled', async () => {
    const o = new Outbox(file);
    const calls: string[] = [];
    const driver = new OutboxDriver(async (t, a) => { calls.push(`${t}/${a}`); return { result: { ok: true } }; }, o);
    const r = await driver.forward('xmtp', 'accounts', {});
    expect(r).toEqual({ result: { ok: true } });
    expect(calls).toEqual(['xmtp/accounts']);
    expect(o.list().length).toBe(0);
    expect(existsSync(file)).toBe(false); // idle: never touched disk
  });

  test('MUTATE success journals one sent entry', async () => {
    const o = new Outbox(file);
    const driver = new OutboxDriver(async () => ({ result: { id: 'm1' } }), o);
    const r = await driver.forward('xmtp', 'send', { line: 'x', text: 'hi' }, mintIdempotencyKey());
    expect(r).toEqual({ result: { id: 'm1' } });
    const list = o.list();
    expect(list.length).toBe(1);
    expect(list[0].state).toBe('sent');
    expect(list[0].attempts).toBe(1);
  });

  test('MUTATE terminal error → dead, no retry scheduled', async () => {
    const o = new Outbox(file);
    let n = 0;
    const driver = new OutboxDriver(async (): Promise<TrainCallResponse> => { n++; return { error: 'invalid line' }; }, o);
    await driver.forward('xmtp', 'send', {}, 'k');
    await flush();
    expect(n).toBe(1); // no retry
    expect(o.list({ state: 'dead' }).length).toBe(1);
    driver.stop();
  });

  test('MUTATE transient error schedules a retry that can succeed', async () => {
    const o = new Outbox(file);
    let n = 0;
    // 1st call: transient failure; later retry: success.
    const driver = new OutboxDriver(async (): Promise<TrainCallResponse> => {
      n++;
      return n === 1 ? { error: 'timed out' } : { result: { id: 'ok' } };
    }, o);
    // Shrink the wait by monkeypatching the first backoff via a tiny sleep loop:
    await driver.forward('xmtp', 'send', {}, 'k');
    // First attempt failed → entry is `failed`, a retry timer is armed.
    expect(o.list()[0].state).toBe('failed');
    // Wait out the first backoff (2s) then assert it flipped to sent.
    await new Promise(r => setTimeout(r, RETRY_BACKOFFS_MS[0] + 200));
    expect(o.get(o.list()[0].outboxId)?.state).toBe('sent');
    expect(n).toBe(2);
    driver.stop();
  }, 10_000);

  test('manual retry requeues a dead entry and re-dispatches it', async () => {
    const o = new Outbox(file);
    let ok = false;
    const driver = new OutboxDriver(async (): Promise<TrainCallResponse> =>
      ok ? { result: { id: 'r' } } : { error: 'invalid' }, o);
    await driver.forward('xmtp', 'send', {}, 'k');
    const id = o.list()[0].outboxId;
    expect(o.get(id)?.state).toBe('dead');
    ok = true;
    expect(driver.retry(id)).toBe(true);
    await flush();
    expect(o.get(id)?.state).toBe('sent');
    expect(driver.retry('out_nonexistent')).toBe(false);
    driver.stop();
  });

  test('recover replays only never-dispatched entries', async () => {
    const o = new Outbox(file);
    const never = o.enqueue('never', 'xmtp', 'send', {});
    const inflight = o.enqueue('inflight', 'xmtp', 'send', {});
    o.markAttempt(inflight.outboxId);
    const dispatched: string[] = [];
    const driver = new OutboxDriver(async (t, a, args) => {
      dispatched.push((args as { tag?: string }).tag ?? '');
      return { result: {} };
    }, o);
    // tag the args so we can see which got re-dispatched
    (o.get(never.outboxId) as OutboxEntry).args = { tag: 'never' };
    (o.get(inflight.outboxId) as OutboxEntry).args = { tag: 'inflight' };
    driver.recover();
    await flush();
    expect(dispatched).toEqual(['never']);
    expect(o.get(never.outboxId)?.state).toBe('sent');
    expect(o.get(inflight.outboxId)?.state).toBe('pending'); // left for manual retry
    driver.stop();
  });
});
