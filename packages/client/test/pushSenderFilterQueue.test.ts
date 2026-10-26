import { describe, expect, test } from 'bun:test';
import { makeSenderFilterPublisher, type SenderFilterInput } from '../src/xmtp/pushSenderFilter';

const TOPIC = '/xmtp/mls/1/g-abcdef/proto';
const OTHER_TOPIC = '/xmtp/mls/1/g-123456/proto';

function deferred() {
  let release = (): void => undefined;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}

function fixture(timeoutMs = 80) {
  const publisher = makeSenderFilterPublisher(Date.now, timeoutMs);
  const bodies: string[] = [];
  const input: SenderFilterInput = {
    installationId: 'a'.repeat(64), current: () => true, signal: new AbortController().signal,
    groupKey: async () => 'b'.repeat(64), sign: async () => new Uint8Array(64),
    syncPreferences: async () => undefined,
    collectTopics: async topic => ({
      topics: [topic ?? TOPIC],
      hmacKeys: { [topic ?? TOPIC]: [{ thirtyDayPeriodsSinceEpoch: 700, hmacKey: new Uint8Array(42).fill(1) }] },
    }),
    post: async body => { await Bun.sleep(10); bodies.push(body.payload); },
  };
  return { publisher, input, bodies };
}

async function seedImportCase(phase: 'group_key' | 'sign' | 'http') {
  const f = fixture(1_000);
  let now = 0;
  let key = 1;
  let held = false;
  const publisher = makeSenderFilterPublisher(() => now, 1_000);
  const entered = deferred();
  const gate = deferred();
  const collecting = deferred();
  const backgroundGate = deferred();
  const controller = new AbortController();
  const hold = async (value: typeof phase): Promise<void> => {
    if (phase !== value || held) return;
    held = true;
    entered.release();
    await gate.promise;
  };
  const collect = f.input.collectTopics;
  const post = f.input.post;
  const input = { ...f.input,
    syncPreferences: async () => { key = now >= 30_000 ? 2 : 1; },
    collectTopics: async (topic?: string) => {
      if (!topic) { collecting.release(); await backgroundGate.promise; }
      const snapshot = await collect(topic);
      snapshot.hmacKeys[TOPIC] = [{ thirtyDayPeriodsSinceEpoch: 700, hmacKey: new Uint8Array(42).fill(key) }];
      return snapshot;
    },
    groupKey: async () => { await hold('group_key'); return 'b'.repeat(64); },
    sign: async () => { await hold('sign'); return new Uint8Array(64); },
    post: async (...args: Parameters<typeof post>) => { await hold('http'); await post(...args); },
  };
  await publisher.warm(input);
  now = 29_999;
  const selected = publisher.publish({ ...input, topic: TOPIC });
  await entered.promise;
  now = 30_000;
  const background = publisher.publish({ ...input, signal: controller.signal }).catch((error: unknown) => error);
  await collecting.promise;
  gate.release();
  try {
    await selected;
    expect(key).toBe(2);
    expect(f.bodies.at(-1)).toContain(Buffer.from(new Uint8Array(42).fill(2)).toString('base64'));
  } finally {
    controller.abort();
    backgroundGate.release();
    await background;
  }
}

function rotatedCollection(input: SenderFilterInput) {
  const collect = input.collectTopics;
  let key = 1;
  input.collectTopics = async topic => {
    const snapshot = await collect(topic);
    if (snapshot.hmacKeys[TOPIC]) snapshot.hmacKeys[TOPIC] = [
      { thirtyDayPeriodsSinceEpoch: 700, hmacKey: new Uint8Array(42).fill(key) },
    ];
    return snapshot;
  };
  return () => { key = 2; };
}

describe('foreground sender-filter isolation', () => {
  test('a stalled account-wide scan cannot consume the selected conversation send deadline', async () => {
    const f = fixture();
    const entered = deferred();
    const gate = deferred();
    const collect = f.input.collectTopics;
    const background = f.publisher.publish({ ...f.input, collectTopics: async topic => {
      entered.release();
      await gate.promise;
      return collect(topic);
    } }).catch((error: unknown) => error);
    await entered.promise;
    try {
      await f.publisher.publish({ ...f.input, topic: OTHER_TOPIC });
      expect(f.bodies).toHaveLength(1);
      expect(f.bodies[0]).toContain(OTHER_TOPIC);
    } finally {
      gate.release();
      await background;
    }
  });

  test('a stalled key read for one conversation does not block another conversation', async () => {
    const f = fixture();
    const entered = deferred();
    const gate = deferred();
    const collect = f.input.collectTopics;
    const stalled = f.publisher.publish({ ...f.input, topic: TOPIC, collectTopics: async topic => {
      entered.release();
      await gate.promise;
      return collect(topic);
    } }).catch((error: unknown) => error);
    await entered.promise;
    try {
      await f.publisher.publish({ ...f.input, topic: OTHER_TOPIC });
      expect(f.bodies).toHaveLength(1);
    } finally {
      gate.release();
      await stalled;
    }
  });

  test.each([undefined, TOPIC])('a delayed %s snapshot is re-read rather than overwriting newer published keys', async topic => {
    const f = fixture(1_000);
    const entered = deferred();
    const gate = deferred();
    const collect = f.input.collectTopics;
    let key = 1;
    let collections = 0;
    const input = { ...f.input, collectTopics: async (selected?: string) => {
      collections += 1;
      const snapshot = await collect(selected);
      snapshot.hmacKeys[TOPIC] = [{ thirtyDayPeriodsSinceEpoch: 700, hmacKey: new Uint8Array(42).fill(key) }];
      if (collections === 1) { entered.release(); await gate.promise; }
      return snapshot;
    } };
    const background = f.publisher.publish({ ...input, topic });
    await entered.promise;
    key = 2;
    await f.publisher.publish({ ...input, topic: TOPIC });
    gate.release();
    await background;
    expect(collections).toBe(3);
    expect(f.bodies).toHaveLength(1);
    expect(f.bodies[0]).toContain(Buffer.from(new Uint8Array(42).fill(2)).toString('base64'));
  });

  test('a snapshot predating a failed or cancelled publication is re-read before a later attempt', async () => {
    for (const cancel of [false, true]) {
      const f = fixture(1_000);
      const entered = deferred();
      const gate = deferred();
      const posting = deferred();
      const controller = new AbortController();
      const collect = f.input.collectTopics;
      let key = 1;
      let collections = 0;
      const input = { ...f.input, collectTopics: async (topic?: string) => {
        collections += 1;
        const snapshot = await collect(topic);
        snapshot.hmacKeys[TOPIC] = [{ thirtyDayPeriodsSinceEpoch: 700, hmacKey: new Uint8Array(42).fill(key) }];
        if (collections === 1) { entered.release(); await gate.promise; }
        return snapshot;
      } };
      const background = f.publisher.publish(input);
      await entered.promise;
      key = 2;
      const failed = f.publisher.publish({ ...input, topic: TOPIC, signal: controller.signal, post: async () => {
        if (!cancel) throw new Error('offline');
        posting.release();
        await new Promise(() => undefined);
      } });
      if (cancel) { await posting.promise; controller.abort(); }
      await expect(failed).rejects.toThrow(cancel ? 'cancelled' : 'offline');
      gate.release();
      await background;
      expect(collections).toBe(3);
      expect(f.bodies).toHaveLength(1);
      expect(f.bodies[0]).toContain(Buffer.from(new Uint8Array(42).fill(2)).toString('base64'));
    }
  });

  test('ready publications still serialize HTTP and re-read changed snapshots', async () => {
    const f = fixture(1_000);
    const entered = deferred();
    const gate = deferred();
    const post = f.input.post;
    let calls = 0;
    let active = 0;
    let maximum = 0;
    f.input.post = async (body, signal) => {
      calls += 1;
      active += 1;
      maximum = Math.max(maximum, active);
      if (calls === 1) { entered.release(); await gate.promise; }
      await post(body, signal);
      active -= 1;
    };
    const first = f.publisher.publish({ ...f.input, topic: TOPIC });
    await entered.promise;
    const second = f.publisher.publish({ ...f.input, topic: OTHER_TOPIC });
    await Bun.sleep(0);
    expect(calls).toBe(1);
    gate.release();
    await Promise.all([first, second]);
    expect(f.bodies).toHaveLength(2);
    expect(maximum).toBe(1);
  });

  test('large account publication yields between acknowledged batches to a selected conversation', async () => {
    const f = fixture(1_000);
    const topics = Array.from({ length: 300 }, (_, i) => `/xmtp/mls/1/g-${i.toString(16)}/proto`);
    const entered = deferred();
    const firstPost = deferred();
    const collect = f.input.collectTopics;
    const post = f.input.post;
    let scans = 0;
    f.input.collectTopics = async topic => {
      if (topic) return collect(topic);
      scans += 1;
      return { topics, hmacKeys: Object.fromEntries(topics.map(value => [value, [
        { thirtyDayPeriodsSinceEpoch: 700, hmacKey: new Uint8Array(42).fill(1) },
      ]])) };
    };
    f.input.post = async (body, signal) => {
      if (f.bodies.length === 0) { entered.release(); await firstPost.promise; }
      await post(body, signal);
    };
    const background = f.publisher.publish(f.input).catch((error: unknown) => error);
    await entered.promise;
    const selected = f.publisher.publish({ ...f.input, topic: OTHER_TOPIC });
    await Bun.sleep(0);
    firstPost.release();
    try {
      await selected;
      expect(f.bodies).toHaveLength(2);
      expect(f.bodies[1]).toContain(OTHER_TOPIC);
    } finally { await background; }
    expect(scans).toBe(1);
    expect(f.bodies.map(body => (JSON.parse(body) as { topics: unknown[] }).topics.length)).toEqual([256, 1, 44]);
  });

  test('preference imports during group-key, signing or HTTP waits require current keys before acknowledgment', async () => {
    for (const phase of ['group_key', 'sign', 'http'] as const) await seedImportCase(phase);
  });

  test('multiple batches reuse an unchanged account snapshot within the original deadline', async () => {
    const f = fixture(150);
    const topics = Array.from({ length: 300 }, (_, i) => `/xmtp/mls/1/g-${i.toString(16)}/proto`);
    let scans = 0;
    f.input.collectTopics = async () => {
      scans += 1;
      await Bun.sleep(100);
      return { topics, hmacKeys: Object.fromEntries(topics.map(topic => [topic, [
        { thirtyDayPeriodsSinceEpoch: 700, hmacKey: new Uint8Array(42).fill(1) },
      ]])) };
    };
    f.input.post = async body => { await Bun.sleep(1); f.bodies.push(body.payload); };
    await f.publisher.publish(f.input);
    expect(scans).toBe(1);
    expect(f.bodies.map(body => (JSON.parse(body) as { topics: unknown[] }).topics.length)).toEqual([256, 44]);
  });

  test('an unrelated publication cannot invalidate an expensive selected-conversation read', async () => {
    const f = fixture(150);
    const entered = deferred();
    const collect = f.input.collectTopics;
    let scans = 0;
    f.input.collectTopics = async topic => {
      if (topic === TOPIC) { scans += 1; entered.release(); await Bun.sleep(100); }
      return collect(topic);
    };
    const selected = f.publisher.publish({ ...f.input, topic: TOPIC });
    await entered.promise;
    await f.publisher.publish({ ...f.input, topic: OTHER_TOPIC });
    await selected;
    expect(scans).toBe(1);
    expect(f.bodies).toHaveLength(2);
  });

  test('clearing a session fences delayed collection and warming from the replacement session', async () => {
    for (const phase of ['collection', 'warming']) {
      const f = fixture(1_000);
      const entered = deferred();
      const gate = deferred();
      const collect = f.input.collectTopics;
      const sync = f.input.syncPreferences;
      if (phase === 'collection') f.input.collectTopics = async topic => { entered.release(); await gate.promise; return collect(topic); };
      else f.input.syncPreferences = async () => { entered.release(); await gate.promise; await sync(); };
      const obsolete = (phase === 'collection' ? f.publisher.publish(f.input) : f.publisher.warm(f.input)).catch((error: unknown) => error);
      await entered.promise;
      f.publisher.clear();
      f.input.collectTopics = collect;
      f.input.syncPreferences = sync;
      await f.publisher.publish({ ...f.input, topic: TOPIC });
      gate.release();
      expect(await obsolete).toBeInstanceOf(Error);
      expect(f.bodies).toHaveLength(1);
    }
  });

  test('a selected snapshot queued behind an unrelated request is read again before publication', async () => {
    const f = fixture(1_000);
    const rotate = rotatedCollection(f.input);
    const entered = deferred();
    const queued = deferred();
    const gate = deferred();
    const collect = f.input.collectTopics;
    const post = f.input.post;
    f.input.collectTopics = async topic => { const snapshot = await collect(topic); if (topic === TOPIC) queued.release(); return snapshot; };
    f.input.post = async (body, signal) => { if (f.bodies.length === 0) { entered.release(); await gate.promise; } await post(body, signal); };
    const unrelated = f.publisher.publish({ ...f.input, topic: OTHER_TOPIC });
    await entered.promise;
    const selected = f.publisher.publish({ ...f.input, topic: TOPIC });
    await queued.promise;
    await Bun.sleep(0);
    rotate();
    gate.release();
    await Promise.all([unrelated, selected]);
    expect(f.bodies).toHaveLength(2);
    expect(f.bodies[1]).toContain(Buffer.from(new Uint8Array(42).fill(2)).toString('base64'));
  });

  test('a background collection reading newer keys after a selected acknowledgment does not drop them', async () => {
    const f = fixture(1_000);
    const rotate = rotatedCollection(f.input);
    const entered = deferred();
    const gate = deferred();
    const collect = f.input.collectTopics;
    f.input.collectTopics = async topic => { if (!topic) { entered.release(); await gate.promise; } return collect(topic); };
    const background = f.publisher.publish(f.input);
    await entered.promise;
    await f.publisher.publish({ ...f.input, topic: TOPIC });
    rotate();
    gate.release();
    await background;
    expect(f.bodies).toHaveLength(2);
    expect(f.bodies[1]).toContain(Buffer.from(new Uint8Array(42).fill(2)).toString('base64'));
  });

  test.each([false, true])('a stalled post-wait recollection frees the lane and resumes background work on cancellation=%s', async cancel => {
    const f = fixture(1_000);
    const posting = deferred();
    const firstPost = deferred();
    const recollecting = deferred();
    const recollection = deferred();
    const collect = f.input.collectTopics;
    const post = f.input.post;
    let reads = 0;
    f.input.collectTopics = async topic => {
      if (topic === TOPIC && ++reads === 2) { recollecting.release(); await recollection.promise; }
      return collect(topic);
    };
    f.input.post = async (body, signal) => { if (f.bodies.length === 0) { posting.release(); await firstPost.promise; } await post(body, signal); };
    const first = f.publisher.publish({ ...f.input, topic: OTHER_TOPIC });
    await posting.promise;
    const controller = new AbortController();
    const stalled = f.publisher.publish({ ...f.input, topic: TOPIC, signal: controller.signal }).catch((error: unknown) => error);
    await Bun.sleep(0);
    firstPost.release();
    await recollecting.promise;
    let finished = false;
    let backgroundFinished = false;
    const background = f.publisher.publish(f.input).then(() => { backgroundFinished = true; });
    const healthy = f.publisher.publish({ ...f.input, topic: OTHER_TOPIC }).then(() => { finished = true; });
    try {
      await Bun.sleep(0);
      expect(finished).toBe(true);
      expect(backgroundFinished).toBe(false);
      if (cancel) { controller.abort(); expect(await stalled).toBeInstanceOf(Error); await background; }
    } finally { recollection.release(); await Promise.all([first, stalled, healthy, background]); }
    expect(f.bodies).toHaveLength(2);
    expect(backgroundFinished).toBe(true);
  });
});
