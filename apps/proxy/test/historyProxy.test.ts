import { describe, expect, test } from 'bun:test';
import { handleHistory, parseHistoryRoute } from '../src/historyProxy.ts';

describe('parseHistoryRoute', () => {
  test('maps upload and file downloads per environment', () => {
    expect(parseHistoryRoute('/xmtp-history/production/upload', 'POST')).toEqual({
      upstream: 'https://message-history.production.ephemera.network/upload', method: 'POST',
    });
    expect(parseHistoryRoute('/xmtp-history/dev/files/abc-123_Z', 'GET')).toEqual({
      upstream: 'https://message-history.dev.ephemera.network/files/abc-123_Z', method: 'GET',
    });
  });

  test('rejects unknown environments, methods, ids and extra segments', () => {
    expect(parseHistoryRoute('/xmtp-history/staging/upload', 'POST')).toBeNull();
    expect(parseHistoryRoute('/xmtp-history/production/upload', 'GET')).toBeNull();
    expect(parseHistoryRoute('/xmtp-history/production/files/../etc', 'GET')).toBeNull();
    expect(parseHistoryRoute('/xmtp-history/production/files/a/b', 'GET')).toBeNull();
    expect(parseHistoryRoute('/xmtp-history/production/files', 'GET')).toBeNull();
    expect(parseHistoryRoute('/other', 'GET')).toBeNull();
  });
});

describe('handleHistory', () => {
  test('answers preflight with permissive CORS headers', async () => {
    const res = await handleHistory(new Request('https://proxy.stage.box/xmtp-history/production/upload', { method: 'OPTIONS' }));
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('access-control-allow-methods')).toContain('POST');
  });

  test('returns a CORS-tagged 404 for paths outside the route table', async () => {
    const res = await handleHistory(new Request('https://proxy.stage.box/xmtp-history/production/nope', { method: 'GET' }));
    expect(res.status).toBe(404);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });
});
