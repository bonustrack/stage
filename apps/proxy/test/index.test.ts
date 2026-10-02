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
