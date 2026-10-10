import { describe, expect, test } from 'bun:test';
import worker, { NODE_LIMITS, REQUEST_MAX_BYTES, dispatchNode, type DispatchDeps } from '../src/index.ts';

const ID = '0123456789abcdef0123456789abcdef';
const NODE_URL = `https://nodes.stage.box/${ID}`;
const CARD = JSON.stringify({ type: 'Card', children: [] });

interface Dispatched { name: string; options: unknown; request: Request }

function namespace(node: (request: Request) => Response | Promise<Response>): { nodes: DispatchNamespace; seen: Dispatched[] } {
  const seen: Dispatched[] = [];
  const nodes = {
    get: (name: string, _args?: unknown, options?: unknown) => {
      if (!name.startsWith('node-')) throw new Error(`Worker not found: ${name}`);
      return { fetch: async (request: Request) => { seen.push({ name, options, request }); return node(request); } };
    },
  } as unknown as DispatchNamespace;
  return { nodes, seen };
}

function call(request: Request | string, deps: DispatchDeps): Promise<Response> {
  return dispatchNode(typeof request === 'string' ? new Request(request) : request, deps);
}

describe('routing', () => {
  test('runs nodes.stage.box/<id> as node-<id> with the CPU and subrequest limits', async () => {
    const { nodes, seen } = namespace(() => new Response(CARD));
    const res = await call(`${NODE_URL}/sub?x=1`, { nodes });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(CARD);
    expect(seen).toHaveLength(1);
    expect(seen[0]?.name).toBe(`node-${ID}`);
    expect(seen[0]?.options).toEqual({ limits: NODE_LIMITS });
    expect(NODE_LIMITS).toEqual({ cpuMs: 50, subRequests: 5 });
    expect(seen[0]?.request.url).toBe(`${NODE_URL}/sub?x=1`);
  });

  test('passes the signed request through unchanged', async () => {
    const { nodes, seen } = namespace(() => new Response(CARD));
    const body = JSON.stringify({ type: 'threads.sync_custom_action' });
    const headers = { 'stage-key': 'k', 'stage-timestamp': '1', 'stage-signature': 's', 'content-length': String(body.length) };
    await call(new Request(NODE_URL, { method: 'POST', body, headers }), { nodes });
    expect(seen[0]?.request.method).toBe('POST');
    expect(seen[0]?.request.headers.get('stage-signature')).toBe('s');
    expect(await seen[0]?.request.text()).toBe(body);
  });

  test('never hands a node the cookies of stage.box', async () => {
    const { nodes, seen } = namespace(() => new Response(CARD));
    const body = '{}';
    await call(new Request(NODE_URL, { method: 'POST', body, headers: { cookie: 'session=1', 'content-length': '2', 'stage-key': 'k' } }), { nodes });
    expect(seen[0]?.request.headers.get('cookie')).toBeNull();
    expect(seen[0]?.request.headers.get('stage-key')).toBe('k');
    expect(await seen[0]?.request.text()).toBe(body);
  });

  test('refuses anything that is not a node id', async () => {
    const { nodes, seen } = namespace(() => new Response(CARD));
    for (const path of ['', '/', '/health', `/${ID.toUpperCase()}`, `/${ID}0`, `/${ID.slice(1)}`, `/%30${ID.slice(1)}`, `/x/${ID}`, `/node-${ID}`]) {
      expect((await call(`https://nodes.stage.box${path}`, { nodes })).status).toBe(404);
    }
    expect(seen).toEqual([]);
  });

  test('answers CORS itself and allows only GET and POST', async () => {
    const { nodes, seen } = namespace(() => new Response(CARD));
    const pre = await call(new Request(NODE_URL, { method: 'OPTIONS' }), { nodes });
    expect(pre.status).toBe(204);
    expect(pre.headers.get('access-control-allow-origin')).toBe('*');
    expect(pre.headers.get('access-control-allow-methods')).toBe('GET, POST, OPTIONS');
    expect(pre.headers.get('access-control-allow-headers')).toBe('content-type, stage-key, stage-timestamp, stage-signature');
    for (const method of ['PUT', 'DELETE', 'PATCH', 'HEAD']) expect((await call(new Request(NODE_URL, { method }), { nodes })).status).toBe(405);
    expect(seen).toEqual([]);
  });

  test('is off without the namespace binding', async () => {
    expect((await call(NODE_URL, {})).status).toBe(503);
    const env = {} as Parameters<typeof worker.fetch>[1];
    expect((await worker.fetch(new Request(NODE_URL), env)).status).toBe(503);
  });
});

describe('abuse limits', () => {
  test('refuses calls from other Workers, so nodes cannot call each other in a loop', async () => {
    const { nodes, seen } = namespace(() => new Response(CARD));
    expect((await call(new Request(NODE_URL, { headers: { 'cf-worker': 'stage.box' } }), { nodes })).status).toBe(403);
    expect(seen).toEqual([]);
  });

  test('caps request bodies and needs their length', async () => {
    const { nodes, seen } = namespace(() => new Response(CARD));
    const big = 'x'.repeat(REQUEST_MAX_BYTES + 1);
    expect((await call(new Request(NODE_URL, { method: 'POST', body: big, headers: { 'content-length': String(big.length) } }), { nodes })).status).toBe(413);
    expect((await call(new Request(NODE_URL, { method: 'POST', body: new Blob(['{}']).stream() }), { nodes })).status).toBe(413);
    expect(seen).toEqual([]);
  });

  test('rate limits per client address', async () => {
    const keys: string[] = [];
    const limiter = { limit: ({ key }: { key: string }) => { keys.push(key); return Promise.resolve({ success: false }); } } as unknown as RateLimit;
    const { nodes, seen } = namespace(() => new Response(CARD));
    const res = await call(new Request(NODE_URL, { headers: { 'cf-connecting-ip': '203.0.113.7' } }), { nodes, limiter });
    expect(res.status).toBe(429);
    expect(keys).toEqual(['203.0.113.7']);
    expect(seen).toEqual([]);
  });

  test('times out a node that never answers', async () => {
    const { nodes } = namespace(() => new Promise<Response>(() => undefined));
    const res = await call(NODE_URL, { nodes, timeoutMs: 20 });
    expect(res.status).toBe(504);
  });
});

describe('replies', () => {
  test('are always JSON from nodes.stage.box, never a page, a cookie or a redirect', async () => {
    const { nodes } = namespace(() => new Response('<script>alert(1)</script>', {
      headers: { 'content-type': 'text/html', 'set-cookie': 'a=b; Domain=stage.box', location: 'https://evil.example' },
    }));
    const res = await call(NODE_URL, { nodes });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(res.headers.get('content-security-policy')).toBe("default-src 'none'; frame-ancestors 'none'; sandbox");
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('set-cookie')).toBeNull();
    expect(res.headers.get('location')).toBeNull();
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    for (const status of [301, 302, 307, 308]) {
      const redirect = namespace(() => new Response(null, { status, headers: { location: 'https://evil.example' } }));
      const moved = await call(NODE_URL, { nodes: redirect.nodes });
      expect(moved.status).toBe(502);
      expect(moved.headers.get('location')).toBeNull();
    }
  });

  test('keep the node status and body, and an empty 204', async () => {
    const failing = namespace(() => Response.json({ error: 'bad action' }, { status: 400 }));
    const bad = await call(NODE_URL, { nodes: failing.nodes });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: 'bad action' });
    const unchanged = await call(NODE_URL, { nodes: namespace(() => new Response(null, { status: 204 })).nodes });
    expect(unchanged.status).toBe(204);
    expect(await unchanged.text()).toBe('');
  });

  test('stop at 128 KB, declared or streamed', async () => {
    const limit = 128 * 1024;
    const exact = await call(NODE_URL, { nodes: namespace(() => new Response('x'.repeat(limit))).nodes });
    expect(exact.status).toBe(200);
    const declared = namespace(() => new Response('{}', { headers: { 'content-length': String(limit + 1) } }));
    expect((await call(NODE_URL, { nodes: declared.nodes })).status).toBe(502);
    const chunk = new Uint8Array(64 * 1024);
    const streamed = namespace(() => new Response(new ReadableStream({
      pull: (controller) => { controller.enqueue(chunk); },
    })));
    expect((await call(NODE_URL, { nodes: streamed.nodes })).status).toBe(502);
  });

  test('a missing node is 404 and a crash or a hit limit is 502 without details', async () => {
    const missing = { get: () => { throw new Error('Worker not found.'); } } as unknown as DispatchNamespace;
    const gone = await call(NODE_URL, { nodes: missing });
    expect(gone.status).toBe(404);
    expect(await gone.json()).toEqual({ error: 'no such node' });
    const crash = namespace(() => { throw new Error('Exceeded CPU limit with secret detail'); });
    const failed = await call(NODE_URL, { nodes: crash.nodes });
    expect(failed.status).toBe(502);
    expect(await failed.json()).toEqual({ error: 'node failed' });
  });
});
