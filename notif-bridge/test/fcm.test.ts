import { describe, expect, test } from 'bun:test';
import { buildContentlessMessage, isDeadTokenResponse } from '../src/fcm.ts';

describe('buildContentlessMessage', () => {
  test('is data-only with no notification block and channelId xmtp', () => {
    const msg = buildContentlessMessage('device-token', { convId: 'c', messageId: 'm' });
    expect(msg.message.token).toBe('device-token');
    expect(msg.message.android.priority).toBe('HIGH');
    expect(msg.message.data.channelId).toBe('xmtp');
    expect(msg.message.data.convId).toBe('c');
    expect('notification' in msg.message).toBe(false);
  });

  test('does not carry any plaintext keys', () => {
    const msg = buildContentlessMessage('t', { convId: 'c', messageId: 'm' });
    const keys = Object.keys(msg.message.data);
    for (const forbidden of ['title', 'body', 'text', 'preview', 'sender', 'senderName', 'avatar']) {
      expect(keys).not.toContain(forbidden);
    }
  });
});

describe('isDeadTokenResponse', () => {
  test('flags 404 and UNREGISTERED style errors', () => {
    expect(isDeadTokenResponse(404, '')).toBe(true);
    expect(isDeadTokenResponse(400, 'UNREGISTERED')).toBe(true);
    expect(isDeadTokenResponse(400, 'registration-token-not-registered')).toBe(true);
  });

  test('does not flag transient/other errors', () => {
    expect(isDeadTokenResponse(400, 'INVALID_ARGUMENT')).toBe(false);
    expect(isDeadTokenResponse(500, 'internal')).toBe(false);
  });
});
