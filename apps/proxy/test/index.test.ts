import { describe, expect, test } from 'bun:test';
import worker from '../src/index.ts';

type Env = Parameters<typeof worker.fetch>[1];
const env = {} as Env;
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
    const limited = { ATTACHMENT_UPLOADS: { limit: () => Promise.resolve({ success: false }) } } as unknown as Env;
    const request = new Request('https://proxy.stage.box/attachments', { method: 'POST', body: 'x', headers: { 'content-length': '1' } });
    expect((await worker.fetch(request, limited, ctx)).status).toBe(429);
  });
});

const CLIENT_HEADERS = 'content-type, x-stage-client';

describe('route preflight', () => {
  test.each([
    ['/preview?url=https%3A%2F%2Fexample.com', 'GET', 'GET, POST, OPTIONS', CLIENT_HEADERS],
    ['/img?url=https%3A%2F%2Fexample.com%2Fa.png', 'GET', 'GET, POST, OPTIONS', CLIENT_HEADERS],
    ['/x402-settle', 'POST', 'GET, POST, OPTIONS', CLIENT_HEADERS],
    ['/attachments', 'POST', 'GET, HEAD, POST, OPTIONS', 'content-type'],
    [`/attachments/${'b'.repeat(32)}`, 'GET', 'GET, HEAD, POST, OPTIONS', 'content-type'],
    ['/nodes', 'PUT', 'PUT, DELETE, OPTIONS', 'content-type, stage-key, stage-timestamp, stage-signature'],
    ['/xmtp-history/production/upload', 'POST', 'GET, POST, OPTIONS', 'content-type'],
    ['/xmtp-push/notifications.v1.Notifications/RegisterInstallation', 'POST', 'POST, OPTIONS', 'content-type'],
    ['/mail/key', 'POST', 'GET, POST, DELETE, OPTIONS', 'content-type, authorization'],
    ['/names/check?label=someone', 'GET', 'GET, POST, OPTIONS', CLIENT_HEADERS],
  ])('%s answers 204 with its CORS headers, configured or not', async (path, method, methods, headers) => {
    const res = await preflight(path, method);
    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('access-control-allow-methods')).toBe(methods);
    expect(res.headers.get('access-control-allow-headers')).toBe(headers);
    expect(res.headers.get('access-control-max-age')).toBe('86400');
  });

  test('health answers its preflight with the open origin only', async () => {
    const res = await preflight('/health', 'GET');
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('access-control-allow-methods')).toBeNull();
  });

  test('preview still needs the client header on GET', async () => {
    expect((await call('/preview?url=https%3A%2F%2Fexample.com')).status).toBe(403);
    const res = await call('/preview', { headers: { 'x-stage-client': '1' } });
    expect(res.status).toBe(400);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });
});

const REFUSAL_CAP = 1_000;

async function callsUntilRefused(next: (attempt: number) => Promise<Response>): Promise<number> {
  for (let attempt = 0; attempt < REFUSAL_CAP; attempt++) {
    if ((await next(attempt)).status === 429) return attempt;
  }
  throw new Error('the route was never rate limited');
}

const from = (ip: string): Record<string, string> => ({ 'cf-connecting-ip': ip });
const upload = (ip: string): Promise<Response> =>
  call('/xmtp-history/production/upload', { method: 'POST', headers: from(ip), body: 'archive' });

describe('rate limits', () => {
  test('name preflights do not use up the names budget', async () => {
    const headers = from('203.0.113.30');
    const budget = await callsUntilRefused(() => call('/names/status?address=0x0', { headers: from('203.0.113.31') }));
    const preflights = await Promise.all(
      Array.from({ length: budget + 1 }, () => call('/names/check?label=someone', { method: 'OPTIONS', headers })),
    );
    expect(preflights.every((res) => res.status === 204)).toBe(true);
    expect((await call('/names/status?address=0x0', { headers })).status).toBe(503);
  });

  test('name lookups do not use up the history upload budget', async () => {
    await callsUntilRefused(() => call('/names/status?address=0x0', { headers: from('203.0.113.7') }));
    expect((await upload('203.0.113.7')).status).toBe(503);
  });

  test('settle refuses other methods before it counts the request', async () => {
    const budget = await callsUntilRefused(() => call('/x402-settle', { method: 'POST', headers: from('203.0.113.20') }));
    const headers = from('203.0.113.21');
    const refused = await Promise.all(Array.from({ length: budget + 1 }, () => call('/x402-settle', { headers })));
    expect(refused.every((res) => res.status === 405)).toBe(true);
    expect(await refused[0]?.json()).toEqual({ error: 'method not allowed' });
    expect((await call('/x402-settle', { method: 'POST', headers })).status).toBe(400);
  });

  test('image requests have their own budget, counted even when the request is invalid', async () => {
    const headers = from('203.0.113.22');
    expect((await call('/img', { headers })).status).toBe(400);
    await callsUntilRefused(() => call('/img', { headers }));
    const refused = await call('/img', { headers });
    expect(await refused.json()).toEqual({ error: 'rate limited' });
    expect((await call('/names/status?address=0x0', { headers })).status).not.toBe(429);
  });

  test('history reads do not use up the upload budget', async () => {
    const budget = await callsUntilRefused(() => upload('203.0.113.24'));
    const headers = from('203.0.113.23');
    const file = `/xmtp-history/production/files/${'0'.repeat(8)}-0000-0000-0000-${'0'.repeat(12)}`;
    const reads = await Promise.all(Array.from({ length: budget + 1 }, () => call(file, { headers })));
    expect(reads.every((res) => res.status === 503)).toBe(true);
    expect((await upload('203.0.113.23')).status).toBe(503);
  });

  test('rate limits key on the Cloudflare client IP, never on x-forwarded-for', async () => {
    await callsUntilRefused((attempt) => call('/img', { headers: { 'x-forwarded-for': `198.51.100.${attempt % 250}` } }));
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
    const push = await call('/xmtp-push/Nope', { method: 'POST', body: '{}' });
    expect(push.status).toBe(404);
    expect(push.headers.get('access-control-allow-methods')).toBe('POST, OPTIONS');
    const mail = await call('/mail/key?label=alice1');
    expect(mail.status).toBe(503);
    expect(await mail.json()).toEqual({ error: 'mail is not configured' });
  });
});

describe('request body caps', () => {
  const kb = (n: number): string => 'x'.repeat(n * 1024);
  const chunked = (text: string): ReadableStream<Uint8Array> => new Blob([text]).stream();

  test.each([
    ['/names/claim', 'GET, POST, OPTIONS'],
    ['/mail/key', 'GET, POST, DELETE, OPTIONS'],
    ['/x402-settle', 'GET, POST, OPTIONS'],
  ])('%s refuses a JSON body over 64 KB with its CORS headers, declared or streamed', async (path, methods) => {
    const headers = from('203.0.113.40');
    for (const body of [kb(65), chunked(kb(65))]) {
      const res = await call(path, { method: 'POST', headers, body });
      expect(res.status).toBe(413);
      expect(await res.json()).toEqual({ error: 'request too large' });
      expect(res.headers.get('access-control-allow-methods')).toBe(methods);
    }
    expect((await call(path, { method: 'POST', headers, body: kb(63) })).status).not.toBe(413);
  });

  test('push bodies are capped at 2 MB in bytes', async () => {
    const big = await call('/xmtp-push/RegisterInstallation', { method: 'POST', body: 'é'.repeat(1_000_001) });
    expect(big.status).toBe(413);
    expect(big.headers.get('access-control-allow-methods')).toBe('POST, OPTIONS');
    expect((await call('/xmtp-push/Nope', { method: 'POST', body: chunked('{}') })).status).toBe(404);
  });
});
