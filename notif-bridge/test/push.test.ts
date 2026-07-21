import { describe, expect, test } from 'bun:test';
import { buildPushData, fanOutContentless } from '../src/push.ts';
import { memoryTokenStore, type StoredPushToken } from '../src/tokens.ts';
import type { FcmSender } from '../src/fcm.ts';

describe('buildPushData', () => {
  test('carries routing metadata only, lowercased convId, no plaintext', () => {
    const data = buildPushData({
      account: 'bridge',
      line: 'metro://xmtp/bridge/CONV',
      convId: 'CONV',
      messageId: 'msg-1',
      isGroup: true,
    });
    expect(data).toEqual({
      account: 'bridge',
      line: 'metro://xmtp/bridge/CONV',
      convId: 'conv',
      messageId: 'msg-1',
      isGroup: 'true',
    });
  });

  test('omits isGroup for dms', () => {
    const data = buildPushData({
      account: 'bridge',
      line: 'metro://xmtp/bridge/c',
      convId: 'c',
      messageId: 'm',
      isGroup: false,
    });
    expect(data.isGroup).toBeUndefined();
  });
});

function recordingSender(results: Record<string, 'ok' | 'dead' | 'error'>): FcmSender & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    send: async (token) => {
      calls.push(token);
      return results[token] ?? 'ok';
    },
  };
}

describe('fanOutContentless', () => {
  test('sends to account targets excluding the sender inbox', async () => {
    const seed: StoredPushToken[] = [
      { token: 'self-dev', account: 'bridge', registeredAt: 'now', inboxId: 'self' },
      { token: 'peer-dev', account: 'bridge', registeredAt: 'now', inboxId: 'peer' },
    ];
    const store = memoryTokenStore(seed);
    const fcm = recordingSender({});
    const res = await fanOutContentless(
      store,
      fcm,
      { account: 'bridge', line: 'l', convId: 'c', messageId: 'm', isGroup: false },
      'self',
    );
    expect(fcm.calls).toEqual(['peer-dev']);
    expect(res.sent).toBe(1);
  });

  test('prunes dead tokens from the store', async () => {
    const store = memoryTokenStore([
      { token: 'dead-dev', account: 'bridge', registeredAt: 'now', inboxId: 'peer' },
    ]);
    const fcm = recordingSender({ 'dead-dev': 'dead' });
    const res = await fanOutContentless(
      store,
      fcm,
      { account: 'bridge', line: 'l', convId: 'c', messageId: 'm', isGroup: false },
    );
    expect(res.pruned).toBe(1);
    expect(store.load()).toHaveLength(0);
  });
});
