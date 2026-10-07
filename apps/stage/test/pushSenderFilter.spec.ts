import { describe, expect, test } from 'bun:test';
import { makeSenderFilterPublisher, maintainPushPaths, prepareNotifyingSend, type SenderFilterInput } from '../lib/pushSenderFilter.core';
import { CALL_INVITE_CODEC, CALL_SIGNAL_CODEC } from '@stage-labs/client/xmtp/jsonCodecs';
import type { PushTopics } from '../lib/pushRegistration.core';

const TOPIC = '/xmtp/mls/1/g-abcdef/proto';
const PERIOD = 700;

function fixture(timeoutMs = 1_000) {
  const controller = new AbortController();
  const publisher = makeSenderFilterPublisher(() => now, timeoutMs);
  let now = PERIOD * 30 * 24 * 60 * 60 * 1_000;
  let key = new Uint8Array(42).fill(1);
  let current = true;
  let fail = false;
  let sync: () => Promise<unknown> = async () => undefined;
  const bodies: string[] = [];
  const collect = async (): Promise<PushTopics> => ({
    topics: [TOPIC, '/xmtp/mls/1/w-installation/proto'],
    hmacKeys: { [TOPIC]: [{ thirtyDayPeriodsSinceEpoch: PERIOD, hmacKey: key }] },
  });
  const input: SenderFilterInput = {
    installationId: 'a'.repeat(64), current: () => current, signal: controller.signal,
    groupKey: async () => 'b'.repeat(64), sign: async () => new Uint8Array(64),
    syncPreferences: () => sync(), collectTopics: collect,
    post: async body => { if (fail) throw new Error('offline'); bodies.push(body.payload); },
  };
  return {
    publisher, input, bodies, controller,
    setCurrent: (value: boolean) => { current = value; },
    setKey: (value: number) => { key = new Uint8Array(42).fill(value); },
    setFailure: (value: boolean) => { fail = value; },
    setSync: (value: typeof sync) => { sync = value; },
    advance: (ms: number) => { now += ms; },
  };
}

function deferred() {
  let release = (): void => undefined;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}

describe('account-wide sender publication without a push token', () => {
  test('receiving registration starts independently and remains maintained when publication fails', async () => {
    const gate = deferred();
    let received = false;
    const work = maintainPushPaths(async () => { await gate.promise; throw new Error('filter offline'); }, async () => { received = true; });
    expect(received).toBe(true);
    gate.release();
    await expect(work).rejects.toThrow('filter offline');
  });

  test('call control bypasses publication while notifying messages fail closed and account checks remain', async () => {
    let checks = 0;
    const check = (): void => { checks += 1; };
    const publish = async (): Promise<void> => { throw new Error('offline'); };
    await prepareNotifyingSend(CALL_SIGNAL_CODEC.shouldPush(), publish, check);
    expect(checks).toBe(2);
    await expect(prepareNotifyingSend(CALL_INVITE_CODEC.shouldPush(), publish, check)).rejects.toThrow('offline');
    await expect(prepareNotifyingSend(false, publish, () => { throw new Error('account changed'); })).rejects.toThrow('account changed');
  });

  test('selected conversation collection never requests an account-wide scan', async () => {
    const f = fixture();
    const original = f.input.collectTopics;
    f.input.collectTopics = async topic => { expect(topic).toBe(TOPIC); return original(topic); };
    await f.publisher.publish({ ...f.input, topic: TOPIC });
    expect(f.bodies).toHaveLength(1);
  });

  test('the deadline includes all time spent behind a stalled refresh', async () => {
    const f = fixture(50);
    f.setSync(() => new Promise(() => undefined));
    const started = performance.now();
    const outcomes = await Promise.allSettled(Array.from({ length: 5 }, () => f.publisher.publish(f.input)));
    expect(outcomes.every(result => result.status === 'rejected')).toBe(true);
    expect(performance.now() - started).toBeLessThan(200);
    expect(f.bodies).toHaveLength(0);
    f.setSync(async () => undefined);
    await f.publisher.publish(f.input);
    expect(f.bodies).toHaveLength(1);
  });

  test('publishes keys after sync, without tokens, subscriptions or plaintext', async () => {
    const f = fixture();
    f.setSync(async () => { f.setKey(2); });
    await f.publisher.publish(f.input);
    const body = JSON.parse(f.bodies[0] ?? '{}') as { topics: { topic: string; hmacKeys: { key: string }[] }[] };
    expect(body.topics).toHaveLength(1);
    expect(body.topics[0]?.topic).toBe(TOPIC);
    expect(body.topics[0]?.hmacKeys[0]?.key).toBe(Buffer.from(new Uint8Array(42).fill(2)).toString('base64'));
    expect(Object.keys(body).sort()).toEqual(['groupKey', 'installationId', 'issuedAt', 'topics']);
  });

  test('unchanged keys skip HTTP; rotation, cache expiry and cleared sessions republish', async () => {
    const f = fixture();
    await f.publisher.publish(f.input);
    await f.publisher.publish(f.input);
    expect(f.bodies).toHaveLength(1);
    f.setKey(2);
    await f.publisher.publish(f.input);
    expect(f.bodies).toHaveLength(2);
    f.advance(240_000);
    await f.publisher.publish(f.input);
    expect(f.bodies).toHaveLength(3);
    f.publisher.clear();
    await f.publisher.publish(f.input);
    expect(f.bodies).toHaveLength(4);
  });

  test('an empty account still signs its own enrollment and never skips a changed group', async () => {
    const f = fixture();
    const input = { ...f.input, collectTopics: async () => ({ topics: [], hmacKeys: {} }) };
    await f.publisher.publish(input);
    await f.publisher.publish(input);
    expect(f.bodies).toHaveLength(1);
    await f.publisher.publish({ ...input, groupKey: async () => 'c'.repeat(64) });
    expect(f.bodies).toHaveLength(2);
  });

  test('a failed update remains retryable and cannot authorize a send', async () => {
    const f = fixture();
    f.setFailure(true);
    let sent = false;
    await expect(f.publisher.publish(f.input).then(() => { sent = true; })).rejects.toThrow('offline');
    expect(sent).toBe(false);
    f.setFailure(false);
    await f.publisher.publish(f.input);
    expect(f.bodies).toHaveLength(1);
  });

  test('separate installations each enroll; selected-topic sends require an actual key', async () => {
    const f = fixture();
    await f.publisher.publish(f.input);
    await f.publisher.publish({ ...f.input, installationId: 'c'.repeat(64) });
    expect(f.bodies).toHaveLength(2);
    await expect(f.publisher.publish({ ...f.input, topic: '/xmtp/mls/1/g-missing/proto' })).rejects.toThrow('not ready');
    expect(f.bodies).toHaveLength(2);
  });

  test('an account switch during sync or signing never publishes the obsolete account', async () => {
    for (const phase of ['sync', 'sign']) {
      const f = fixture();
      if (phase === 'sync') f.setSync(async () => { f.setCurrent(false); });
      else f.input.sign = async () => { f.setCurrent(false); return new Uint8Array(64); };
      await expect(f.publisher.publish(f.input)).rejects.toThrow('account changed');
      expect(f.bodies).toHaveLength(0);
    }
  });

  test('rotation refreshes serialize and use the keys read after the preceding request', async () => {
    const f = fixture();
    const gate = deferred();
    const entered = deferred();
    f.setSync(async () => { entered.release(); await gate.promise; });
    const first = f.publisher.publish(f.input);
    await entered.promise;
    f.setKey(2);
    const second = f.publisher.publish(f.input);
    gate.release();
    await Promise.all([first, second]);
    expect(f.bodies).toHaveLength(1);
    expect(f.bodies[0]).toContain(Buffer.from(new Uint8Array(42).fill(2)).toString('base64'));
  });

  test('closed-worker cancellation and timeout free the queue for the replacement session', async () => {
    for (const abort of [false, true]) {
      const f = fixture(10);
      const entered = deferred();
      f.setSync(() => { entered.release(); return new Promise(() => undefined); });
      const old = f.publisher.publish(f.input);
      await entered.promise;
      if (abort) f.controller.abort();
      await expect(old).rejects.toThrow(abort ? 'cancelled' : 'timed out');
      f.setSync(async () => undefined);
      await f.publisher.publish({ ...f.input, signal: new AbortController().signal });
      expect(f.bodies).toHaveLength(1);
    }
  });

  test('large accounts split bounded batches and preserve partial-success retryability', async () => {
    const f = fixture();
    const topics = Array.from({ length: 300 }, (_, i) => `/xmtp/mls/1/g-${i.toString(16)}/proto`);
    f.input.collectTopics = async () => ({ topics, hmacKeys: Object.fromEntries(topics.map(topic => [topic, [
      { thirtyDayPeriodsSinceEpoch: PERIOD, hmacKey: new Uint8Array(42) },
    ]])) });
    const originalPost = f.input.post;
    f.input.post = async (body, signal) => { if (f.bodies.length === 1) throw new Error('offline'); await originalPost(body, signal); };
    await expect(f.publisher.publish(f.input)).rejects.toThrow('offline');
    expect(f.bodies).toHaveLength(1);
    f.input.post = originalPost;
    await f.publisher.publish(f.input);
    expect(f.bodies).toHaveLength(2);
    const counts = f.bodies.map(body => (JSON.parse(body) as { topics: unknown[] }).topics.length);
    expect(counts).toEqual([256, 44]);
  });
});
