import { describe, expect, test } from 'bun:test';
import worker from '../src/index.ts';

const env = {} as Parameters<typeof worker.fetch>[1];
const ctx = {} as ExecutionContext;

function call(path: string, init: RequestInit = {}): Promise<Response> {
  return worker.fetch(new Request(`https://proxy.stage.box${path}`, init), env, ctx);
}

function preflight(path: string, method: string): Promise<Response> {
  return call(path, {
    method: 'OPTIONS',
    headers: {
      origin: 'https://stage.box',
      'access-control-request-method': method,
      'access-control-request-headers': 'content-type,x-stage-client',
    },
  });
}

describe('attachment routes', () => {
  test('are wired, answer preflight and say when no bucket is bound', async () => {
    const pre = await preflight('/attachments', 'POST');
    expect(pre.status).toBe(204);
    expect(pre.headers.get('access-control-allow-methods')).toContain('POST');
    const res = await call('/attachments', { method: 'POST', body: 'x', headers: { 'content-length': '1' } });
    expect(res.status).toBe(503);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect((await call(`/attachments/${'b'.repeat(32)}`)).status).toBe(503);
  });

  test('an upload refused by the edge rate limit is 429 before touching storage', async () => {
    const limited = { ATTACHMENT_UPLOADS: { limit: () => Promise.resolve({ success: false }) } } as unknown as Parameters<typeof worker.fetch>[1];
    const res = await worker.fetch(new Request('https://proxy.stage.box/attachments', { method: 'POST', body: 'x', headers: { 'content-length': '1' } }), limited, ctx);
    expect(res.status).toBe(429);
  });
});

describe('client route preflight', () => {
  test.each([
    ['/preview?url=https%3A%2F%2Fexample.com', 'GET'],
    ['/img?url=https%3A%2F%2Fexample.com%2Fa.png', 'GET'],
    ['/x402-settle', 'POST'],
  ])('%s answers 204 with CORS headers', async (path, method) => {
    const res = await preflight(path, method);
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('access-control-allow-methods')).toContain(method);
    expect(res.headers.get('access-control-allow-headers')).toContain('x-stage-client');
    expect(res.headers.get('access-control-max-age')).toBe('86400');
  });

  test('preview still needs the client header on GET', async () => {
    expect((await call('/preview?url=https%3A%2F%2Fexample.com')).status).toBe(403);
    const res = await call('/preview', { headers: { 'x-stage-client': '1' } });
    expect(res.status).toBe(400);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });
});

describe('rate limits', () => {
  test('name lookups do not use up the history upload budget', async () => {
    const headers = { 'cf-connecting-ip': '203.0.113.7' };
    const lookups = await Promise.all(Array.from({ length: 61 }, () => call('/names/status?address=0x0', { headers })));
    expect(lookups.at(-1)?.status).toBe(429);
    const upload = await call('/xmtp-history/production/upload', { method: 'POST', headers, body: 'archive' });
    expect(upload.status).toBe(503);
  });
});
