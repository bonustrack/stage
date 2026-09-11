import { describe, expect, test } from 'bun:test';
import { handlePush, parsePushRoute } from '../src/pushProxy.ts';

describe('parsePushRoute', () => {
  test('maps the three notification RPCs to the push server', () => {
    expect(parsePushRoute('/xmtp-push/RegisterInstallation', 'POST'))
      .toBe('https://push.stage.box/notifications.v1.Notifications/RegisterInstallation');
    expect(parsePushRoute('/xmtp-push/SubscribeWithMetadata', 'POST'))
      .toBe('https://push.stage.box/notifications.v1.Notifications/SubscribeWithMetadata');
    expect(parsePushRoute('/xmtp-push/DeleteInstallation', 'POST'))
      .toBe('https://push.stage.box/notifications.v1.Notifications/DeleteInstallation');
  });

  test('rejects other RPCs, methods and paths', () => {
    expect(parsePushRoute('/xmtp-push/Subscribe', 'POST')).toBeNull();
    expect(parsePushRoute('/xmtp-push/RegisterInstallation', 'GET')).toBeNull();
    expect(parsePushRoute('/xmtp-push/RegisterInstallation/extra', 'POST')).toBeNull();
    expect(parsePushRoute('/other', 'POST')).toBeNull();
  });
});

describe('handlePush', () => {
  test('answers preflight with CORS headers', async () => {
    const res = await handlePush(new Request('https://proxy.stage.box/xmtp-push/RegisterInstallation', { method: 'OPTIONS' }));
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('access-control-allow-methods')).toContain('POST');
  });

  test('returns 404 with CORS headers for unknown routes', async () => {
    const res = await handlePush(new Request('https://proxy.stage.box/xmtp-push/Nope', { method: 'POST', body: '{}' }));
    expect(res.status).toBe(404);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });
});
