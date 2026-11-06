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
    const limited = { ATTACHMENT_UPLOADS: { limit: () => Promise.resolve({ success: false }) } } as unknown as Parameters<
      typeof worker.fetch
    >[1];
    const res = await worker.fetch(
      new Request('https://proxy.stage.box/attachments', { method: 'POST', body: 'x', headers: { 'content-length': '1' } }),
      limited,
      ctx,
    );
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

  test('settle refuses other methods before it counts the request', async () => {
    const headers = { 'cf-connecting-ip': '203.0.113.21' };
    const refused = await Promise.all(Array.from({ length: 61 }, () => call('/x402-settle', { headers })));
    expect(refused.map((res) => res.status)).toEqual(Array.from({ length: 61 }, () => 405));
    expect(await refused[0]?.json()).toEqual({ error: 'method not allowed' });
  });

  test('image requests have their own budget', async () => {
    const headers = { 'cf-connecting-ip': '203.0.113.22' };
    const answers = await Promise.all(Array.from({ length: 61 }, () => call('/img', { headers })));
    expect(answers[0]?.status).toBe(400);
    expect(answers.at(-1)?.status).toBe(429);
    expect(await answers.at(-1)?.json()).toEqual({ error: 'rate limited' });
  });

  test('history reads do not use up the upload budget', async () => {
    const headers = { 'cf-connecting-ip': '203.0.113.23' };
    const file = `/xmtp-history/production/files/${'0'.repeat(8)}-0000-0000-0000-${'0'.repeat(12)}`;
    const reads = await Promise.all(Array.from({ length: 61 }, () => call(file, { headers })));
    expect(reads.every((res) => res.status === 503)).toBe(true);
    const uploads = await Promise.all(
      Array.from({ length: 61 }, () => call('/xmtp-history/production/upload', { method: 'POST', headers, body: 'x' })),
    );
    expect(uploads[0]?.status).toBe(503);
    expect(uploads.at(-1)?.status).toBe(429);
  });

  test('rate limits key on the Cloudflare client IP, never on x-forwarded-for', async () => {
    const answers = await Promise.all(
      Array.from({ length: 61 }, (_, index) => call('/img', { headers: { 'x-forwarded-for': `198.51.100.${index}` } })),
    );
    expect(answers.at(-1)?.status).toBe(429);
  });
});

describe('route table', () => {
  test('health answers ok as plain text', async () => {
    const res = await call('/health');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
    expect(res.headers.get('content-type')).toBe('text/plain');
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('x-served-by')).toBe('worker');
  });

  test('an unknown path is a JSON 404', async () => {
    for (const path of ['/nope', '/xmtp-history', '/previewx', '/attachmentsx']) {
      const res = await call(path);
      expect([path, res.status]).toEqual([path, 404]);
      expect(await res.json()).toEqual({ error: 'not found' });
    }
  });

  test('push and mail are wired to their handlers', async () => {
    const push = await call('/xmtp-push/notifications.v1.Notifications/RegisterInstallation', { method: 'OPTIONS' });
    expect(push.status).toBe(204);
    expect(push.headers.get('access-control-allow-methods')).toBe('POST, OPTIONS');
    const mail = await call('/mail/key?label=alice1');
    expect(mail.status).toBe(503);
    expect(await mail.json()).toEqual({ error: 'mail is not configured' });
  });
});
