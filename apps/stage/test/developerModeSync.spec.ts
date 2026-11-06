import { afterEach, beforeEach, describe, expect, jest, mock, test } from 'bun:test';
import { mergeDeveloperMode, DEFAULT_DEVELOPER_MODE, type DeveloperModeContent } from '@stage-labs/client/xmtp/readState';
import type { RowMessage } from '@stage-labs/client/xmtp/summarizeRow';

let activeId = 'a';
const values = new Map<string, string>();
const states = new Map<string, DeveloperModeContent>();
const messages: RowMessage[] = [];
const queries: { afterNs?: number; beforeNs?: number; limit: number }[] = [];
let failRead = false;
let failWrite = false;
let failApply = false;
let beforeMessages: (() => void) | undefined;
const client = { inboxId: 'owner' };
mock.module('../platform/storage', () => ({
  appStorage: {
    get: async (key: string): Promise<string | null> => {
      if (failRead) throw new Error('read unavailable');
      return values.get(key) ?? null;
    },
    set: async (key: string, value: string): Promise<void> => {
      if (failWrite) throw new Error('write unavailable');
      values.set(key, value);
    },
  },
}));
mock.module('../lib/accounts', () => ({
  getActiveAccount: async () => ({ id: activeId }),
  getActiveAccountStrict: async () => ({ id: activeId, address: activeId }),
}));
mock.module('../lib/xmtp.client', () => ({ cachedSelfEthAddress: () => activeId }));
mock.module('../lib/developerMode', () => ({
  loadDeveloperMode: async (id: string) => states.get(id) ?? null,
  applyRemoteDeveloperMode: async (id: string, incoming: DeveloperModeContent) => {
    if (failApply) throw new Error('preference write unavailable');
    states.set(id, mergeDeveloperMode(states.get(id) ?? DEFAULT_DEVELOPER_MODE, incoming));
  },
}));
mock.module('../lib/xmtp.sdk', () => ({
  convOfLine: async () => null,
  sdk: {
    client: async () => client,
    cachedClient: () => client,
    findConv: async (_client: unknown, id: string) => ({ id }),
    messages: async (_conv: unknown, opts: { afterNs?: number; beforeNs?: number; limit: number }) => {
      queries.push(opts);
      beforeMessages?.();
      return messages
        .filter((m) => m.sentNs > (opts.afterNs ?? 0) && m.sentNs < (opts.beforeNs ?? Infinity))
        .sort((a, b) => b.sentNs - a.sentNs)
        .slice(0, opts.limit);
    },
    rowOf: (message: RowMessage) => message,
  },
}));
const { accountClient } = await import('../lib/xmtp.account');
const { createDeveloperModePublisher, replayDeveloperMode } = await import('../lib/developerModeSync');
const groups = [{ id: 'sync', active: true, createdAtNs: 1 }];
const cursorKey = 'developerMode.cursor.v1.a.sync';
const replay = async (): Promise<void> => replayDeveloperMode(await accountClient(), groups);
const stateMessage = (sentNs: number, enabled: boolean, at: number): RowMessage => ({
  contentTypeId: 'stage.box/developerMode:1.0',
  senderInboxId: 'owner',
  sentNs,
  content: { enabled, at },
});
async function advance(ms: number): Promise<void> {
  jest.advanceTimersByTime(ms);
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
}

beforeEach(() => {
  activeId = 'a';
  values.clear();
  states.clear();
  messages.length = 0;
  queries.length = 0;
  failRead = false;
  failWrite = false;
  failApply = false;
  beforeMessages = undefined;
  jest.useFakeTimers();
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('durable Developer mode publication', () => {
  test('loads the latest durable state after debounce and retries an offline send', async () => {
    jest.useFakeTimers();
    const sent: DeveloperModeContent[] = [];
    let offline = true;
    const queue = createDeveloperModePublisher(async (_id, state) => {
      if (offline) throw new Error('offline');
      sent.push(state);
      return true;
    });
    states.set('a', { enabled: true, at: 1 });
    queue('a');
    await advance(800);
    expect(sent).toEqual([]);
    states.set('a', { enabled: false, at: 2 });
    offline = false;
    await advance(5000);
    expect(sent).toEqual([{ enabled: false, at: 2 }]);
    await advance(60_000);
    expect(sent).toHaveLength(1);
  });

  test('account queues cannot cancel each other and returning to an account recovers its saved edit', async () => {
    jest.useFakeTimers();
    const sent: string[] = [];
    states.set('a', { enabled: true, at: 1 });
    states.set('b', { enabled: false, at: 2 });
    const queue = createDeveloperModePublisher(async (id, state) => {
      sent.push(`${id}:${state.enabled}`);
      return true;
    });
    queue('a');
    activeId = 'b';
    queue('b');
    await advance(800);
    expect(sent).toEqual(['b:false']);
    activeId = 'a';
    queue('a');
    await advance(800);
    expect(sent).toEqual(['b:false', 'a:true']);
  });

  test('a recreated publisher recovers durable OFF after restart and leaves unset accounts silent', async () => {
    jest.useFakeTimers();
    states.set('a', { enabled: false, at: 20 });
    const sent: DeveloperModeContent[] = [];
    const restored = createDeveloperModePublisher(async (_id, state) => {
      sent.push(state);
      return true;
    });
    restored('a');
    await advance(800);
    expect(sent).toEqual([{ enabled: false, at: 20 }]);
    states.delete('a');
    restored('a');
    await advance(800);
    expect(sent).toHaveLength(1);
  });

  test('rate limiting stops automatic Developer mode retries for this session', async () => {
    jest.useFakeTimers();
    states.set('a', { enabled: true, at: 1 });
    let calls = 0;
    const queue = createDeveloperModePublisher(async () => {
      calls += 1;
      throw new Error('429 resource exhausted');
    });
    queue('a');
    await advance(800);
    await advance(600_000);
    queue('a');
    await advance(800);
    expect(calls).toBe(1);
  });
});

describe('independent paginated Developer mode replay', () => {
  test('ignores an old generic cursor that already crossed an unsupported Developer mode message', async () => {
    values.set('readSync.cursor.v4.a.sync', '10000');
    messages.push(stateMessage(100, true, 90));
    await replay();
    expect(states.get('a')).toEqual({ enabled: true, at: 90 });
    expect(values.get(cursorKey)).toBe('100');
    expect(queries[0]?.afterNs).toBe(0);
  });

  test('finds a preference older than the newest 5000 messages and keeps the newest payload clock across pages', async () => {
    messages.push(stateMessage(1, false, 100), stateMessage(2, true, 90));
    for (let i = 3; i <= 5003; i += 1)
      messages.push({ sentNs: i, senderInboxId: 'owner', contentTypeId: 'xmtp.org/text:1.0', content: 'other' });
    await replay();
    expect(queries).toHaveLength(2);
    expect(queries[1]?.beforeNs).toBe(4);
    expect(states.get('a')).toEqual({ enabled: false, at: 100 });
    expect(values.get(cursorKey)).toBe('5003');
    await replay();
    expect(queries.at(-1)?.afterNs).toBe(5003);
  });

  test('paginates over more than 5000 unread messages after an existing feature cursor', async () => {
    values.set(cursorKey, '10');
    messages.push(stateMessage(9, true, 1000), stateMessage(11, false, 100));
    for (let i = 12; i <= 5012; i += 1) messages.push({ sentNs: i, senderInboxId: 'owner', content: 'other' });
    await replay();
    expect(queries).toHaveLength(2);
    expect(queries.every((query) => query.afterNs === 10)).toBe(true);
    expect(states.get('a')).toEqual({ enabled: false, at: 100 });
    expect(values.get(cursorKey)).toBe('5012');
  });

  test('real replay filtering rejects foreign senders, malformed content and future clocks', async () => {
    messages.push(
      stateMessage(1, false, 10),
      { ...stateMessage(2, true, 20), senderInboxId: 'foreign' },
      { ...stateMessage(3, true, 30), content: { enabled: 'yes', at: 30 } },
      stateMessage(4, true, Date.now() + 172_800_000),
    );
    await replay();
    expect(states.get('a')).toEqual({ enabled: false, at: 10 });
    expect(values.get(cursorKey)).toBe('4');
  });

  test('read and preference write failures do not acknowledge history and retry safely', async () => {
    messages.push(stateMessage(10, true, 10));
    failRead = true;
    await expect(replay()).rejects.toThrow('read unavailable');
    expect(queries).toEqual([]);
    expect(values.has(cursorKey)).toBe(false);
    failRead = false;
    failApply = true;
    await expect(replay()).rejects.toThrow('preference write unavailable');
    expect(values.has(cursorKey)).toBe(false);
    failApply = false;
    await replay();
    expect(values.get(cursorKey)).toBe('10');
    expect(states.get('a')?.enabled).toBe(true);
  });

  test('failed cursor persistence replays idempotently instead of losing the preference', async () => {
    messages.push(stateMessage(10, true, 10));
    failWrite = true;
    await expect(replay()).rejects.toThrow('write unavailable');
    expect(states.get('a')).toEqual({ enabled: true, at: 10 });
    expect(values.has(cursorKey)).toBe(false);
    failWrite = false;
    await replay();
    expect(states.get('a')).toEqual({ enabled: true, at: 10 });
    expect(values.get(cursorKey)).toBe('10');
  });

  test('switching accounts during history retrieval cannot apply or advance the wrong account', async () => {
    messages.push(stateMessage(10, true, 10));
    beforeMessages = () => {
      activeId = 'b';
    };
    await expect(replay()).rejects.toThrow('Messaging client does not match the active account');
    expect(states.size).toBe(0);
    expect(values.size).toBe(0);
  });
});
