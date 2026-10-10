import { describe, expect, test } from 'bun:test';
import { nodeIdOf } from '@stage-labs/client/nodes/hosting';
import { newNodeKey, nodeHeaders, nodeKeyId } from '@stage-labs/client/nodes/protocol';
import worker from '../src/index.ts';
import { MAX_NODES, NODES_NAMESPACE, cloudflareApi, handleNodes, type NodesApi } from '../src/nodes.ts';

const URL_NODES = 'https://proxy.stage.box/nodes';
const ACCOUNT = 'a'.repeat(32);
const TOKEN = 'test-token';
const NOW = 1_760_000_000_000;
const CODE = 'export default { fetch: () => Response.json({ type: "Card", children: [] }) };';
const API_BASE = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/workers/dispatch/namespaces/${NODES_NAMESPACE}`;

interface ApiCall { url: string; method: string; auth: string | null; body: FormData | null }

function cloudflare(routes: Record<string, () => Response> = {}): { api: NodesApi; calls: ApiCall[] } {
  const calls: ApiCall[] = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    calls.push({ url, method, auth: new Headers(init?.headers).get('authorization'), body: (init?.body as FormData | undefined) ?? null });
    const route = routes[`${method} ${url.slice(API_BASE.length)}`];
    return route === undefined ? Response.json({ success: true, result: { script_count: 3 } }) : route();
  }) as typeof fetch;
  const api = cloudflareApi(TOKEN, ACCOUNT, fetcher);
  if (api === null) throw new Error('api not configured');
  return { api, calls };
}

function signed(method: 'PUT' | 'DELETE', key: string, body = '', at = NOW, url = URL_NODES): Request {
  const headers: Record<string, string> = nodeHeaders(method, url, body, key, at);
  if (body !== '') headers['content-length'] = String(new TextEncoder().encode(body).byteLength);
  return new Request(url, { method, headers, body: body === '' ? undefined : body });
}

function run(request: Request, api: NodesApi | null, limited = false): Promise<Response> {
  return handleNodes(request, { api, limited: () => Promise.resolve(limited), now: () => NOW });
}

const idOf = (key: string): string => nodeIdOf(nodeKeyId(key)) ?? '';

describe('cloudflareApi', () => {
  test('is off without a token or a well formed account id', () => {
    expect(cloudflareApi(undefined, ACCOUNT)).toBeNull();
    expect(cloudflareApi('', ACCOUNT)).toBeNull();
    expect(cloudflareApi(TOKEN, undefined)).toBeNull();
    expect(cloudflareApi(TOKEN, 'abc/../x')).toBeNull();
    expect(cloudflareApi(TOKEN, ACCOUNT)).not.toBeNull();
    expect(cloudflareApi(` ${TOKEN}\n`, ` ${ACCOUNT.toUpperCase()} `)).not.toBeNull();
  });

  test('the proxy answers 503 on /nodes until the secrets are set', async () => {
    const env = {} as Parameters<typeof worker.fetch>[1];
    const key = newNodeKey();
    const res = await worker.fetch(signed('PUT', key, CODE, Date.now()), env, {} as ExecutionContext);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'nodes are not set up' });
    expect((await worker.fetch(new Request(`${URL_NODES}/x`), env, {} as ExecutionContext)).status).toBe(404);
  });
});

describe('publishing a node', () => {
  test('uploads the code alone, with no bindings, under a name derived from the key', async () => {
    const key = newNodeKey();
    const { api, calls } = cloudflare();
    const res = await run(signed('PUT', key, CODE), api);
    expect(res.status).toBe(200);
    const id = idOf(key);
    expect(id).toMatch(/^[0-9a-f]{32}$/);
    expect(await res.json()).toEqual({ id, url: `https://nodes.stage.box/${id}` });
    expect(calls.map(call => `${call.method} ${call.url}`)).toEqual([`GET ${API_BASE}`, `PUT ${API_BASE}/scripts/node-${id}`]);
    expect(calls.every(call => call.auth === `Bearer ${TOKEN}`)).toBe(true);
    const form = calls[1]?.body;
    expect(JSON.parse(String(form?.get('metadata')))).toEqual({
      main_module: 'node.js', compatibility_date: '2026-06-01', compatibility_flags: ['global_fetch_strictly_public'], bindings: [],
    });
    const module = form?.get('node.js') as File;
    expect(module.type).toBe('application/javascript+module');
    expect(module.name).toBe('node.js');
    expect(await module.text()).toBe(CODE);
    expect([...(form?.keys() ?? [])]).toEqual(['metadata', 'node.js']);
  });

  test('the same key updates the same node, another key gets another node', async () => {
    const key = newNodeKey();
    const { api, calls } = cloudflare();
    await run(signed('PUT', key, CODE), api);
    await run(signed('PUT', key, `${CODE}\n`), api);
    await run(signed('PUT', newNodeKey(), CODE), api);
    const names = calls.filter(call => call.method === 'PUT').map(call => call.url.split('/').pop());
    expect(names[0]).toBe(names[1]);
    expect(names[2]).not.toBe(names[0]);
  });

  test('refuses requests that are not signed by the key they name', async () => {
    const key = newNodeKey();
    const { api, calls } = cloudflare();
    const tampered = signed('PUT', key, CODE);
    const swapped = new Request(URL_NODES, {
      method: 'PUT', body: `${CODE} `, headers: { ...Object.fromEntries(tampered.headers), 'content-length': String(CODE.length + 1) },
    });
    const otherKey = new Headers(signed('PUT', key, CODE).headers);
    otherKey.set('stage-key', nodeKeyId(newNodeKey()));
    const deleteAsPut = new Headers(signed('DELETE', key).headers);
    deleteAsPut.set('content-length', String(CODE.length));
    const rejected = [
      swapped,
      new Request(URL_NODES, { method: 'PUT', body: CODE, headers: otherKey }),
      new Request(URL_NODES, { method: 'PUT', body: CODE, headers: deleteAsPut }),
      signed('PUT', key, CODE, NOW - 6 * 60_000),
      signed('PUT', key, CODE, NOW + 6 * 60_000),
      new Request(URL_NODES, { method: 'PUT', body: CODE, headers: { 'content-length': String(CODE.length) } }),
    ];
    for (const request of rejected) expect((await run(request, api)).status).toBe(401);
    const elsewhere = signed('PUT', key, CODE, NOW, 'https://proxy.stage.box/nodes?x=1');
    expect((await run(new Request(URL_NODES, { method: 'PUT', body: CODE, headers: elsewhere.headers }), api)).status).toBe(401);
    expect(calls).toEqual([]);
  });

  test('checks the size before it reads or verifies anything', async () => {
    const key = newNodeKey();
    const { api, calls } = cloudflare();
    const big = 'x'.repeat(64 * 1024 + 1);
    expect((await run(signed('PUT', key, big), api)).status).toBe(413);
    const chunked = new Request(URL_NODES, { method: 'PUT', body: new Blob([CODE]).stream(), headers: nodeHeaders('PUT', URL_NODES, CODE, key, NOW) });
    expect((await run(chunked, api)).status).toBe(411);
    const empty = new Request(URL_NODES, { method: 'PUT', headers: { ...nodeHeaders('PUT', URL_NODES, '', key, NOW), 'content-length': '0' } });
    expect((await run(empty, api)).status).toBe(400);
    expect((await run(signed('PUT', key, 'x'.repeat(64 * 1024)), api)).status).toBe(200);
    expect(calls.filter(call => call.method === 'PUT')).toHaveLength(1);
  });

  test('answers CORS preflight, refuses other methods and rate limits before any work', async () => {
    const { api, calls } = cloudflare();
    const pre = await run(new Request(URL_NODES, { method: 'OPTIONS' }), api);
    expect(pre.status).toBe(204);
    expect(pre.headers.get('access-control-allow-methods')).toBe('PUT, DELETE, OPTIONS');
    expect(pre.headers.get('access-control-allow-headers')).toBe('content-type, stage-key, stage-timestamp, stage-signature');
    expect((await run(new Request(URL_NODES), api)).status).toBe(405);
    expect((await run(new Request(URL_NODES, { method: 'POST', body: CODE }), api)).status).toBe(405);
    expect((await run(signed('PUT', newNodeKey(), CODE), api, true)).status).toBe(429);
    expect((await run(signed('PUT', newNodeKey(), CODE), null)).status).toBe(503);
    expect(calls).toEqual([]);
  });

  test('stops at the node limit but still lets an owner update an existing node', async () => {
    const key = newNodeKey();
    const id = idOf(key);
    const full = (): Response => Response.json({ success: true, result: { script_count: MAX_NODES } });
    const missing = (): Response => Response.json({ success: false, errors: [{ code: 10007, message: 'not found' }] }, { status: 404 });
    const atLimit = cloudflare({ 'GET ': full, [`GET /scripts/node-${id}`]: missing });
    const refused = await run(signed('PUT', key, CODE), atLimit.api);
    expect(refused.status).toBe(507);
    expect(atLimit.calls.some(call => call.method === 'PUT')).toBe(false);
    const existing = cloudflare({ 'GET ': full, [`GET /scripts/node-${id}`]: () => Response.json({ success: true, result: {} }) });
    expect((await run(signed('PUT', key, CODE), existing.api)).status).toBe(200);
    expect(existing.calls.map(call => call.method)).toEqual(['GET', 'GET', 'PUT']);
  });

  test('maps Cloudflare answers without leaking account details', async () => {
    const key = newNodeKey();
    const script = `PUT /scripts/node-${idOf(key)}`;
    const syntax = (): Response => Response.json({
      success: false, errors: [{ code: 10021, message: `Uncaught SyntaxError: Unexpected token\n  at node.js:1:7 in account ${ACCOUNT}` }],
    }, { status: 400 });
    const refused = await run(signed('PUT', key, CODE), cloudflare({ [script]: syntax }).api);
    expect(refused.status).toBe(400);
    expect(await refused.json()).toEqual({ error: 'Uncaught SyntaxError: Unexpected token at node.js:1:7 in account -' });
    const busy = await run(signed('PUT', key, CODE), cloudflare({ [script]: () => new Response('{}', { status: 429 }) }).api);
    expect(busy.status).toBe(429);
    const down = await run(signed('PUT', key, CODE), cloudflare({ [script]: () => new Response('oops', { status: 500 }) }).api);
    expect(down.status).toBe(502);
    expect(await down.json()).toEqual({ error: 'node hosting failed' });
    const noNamespace = await run(signed('PUT', key, CODE), cloudflare({ 'GET ': () => Response.json({ success: false }, { status: 404 }) }).api);
    expect(noNamespace.status).toBe(503);
    const offline = cloudflareApi(TOKEN, ACCOUNT, (() => Promise.reject(new Error('network'))) as unknown as typeof fetch);
    expect((await run(signed('PUT', key, CODE), offline)).status).toBe(502);
    const badToken = (): Response => Response.json({ success: false, errors: [{ code: 10001, message: 'Authentication failed (status: 400)' }] }, { status: 400 });
    const unauthorized = await run(signed('PUT', key, CODE), cloudflare({ 'GET ': badToken }).api);
    expect(unauthorized.status).toBe(502);
    expect(await unauthorized.json()).toEqual({ error: 'node hosting failed' });
    const deleteRefused = cloudflare({ [`DELETE /scripts/node-${idOf(key)}`]: badToken });
    expect((await run(signed('DELETE', key), deleteRefused.api)).status).toBe(502);
  });
});

describe('signature edge cases', () => {
  test('code starting with a byte order mark keeps its exact bytes', async () => {
    const key = newNodeKey();
    const { api, calls } = cloudflare();
    const code = `\uFEFF${CODE}`;
    expect((await run(signed('PUT', key, code), api)).status).toBe(200);
    const module = calls[1]?.body?.get('node.js') as File;
    expect(new Uint8Array(await module.arrayBuffer())).toEqual(new TextEncoder().encode(code));
  });

  test('a small order key with a forged signature is refused', async () => {
    const identity = new Uint8Array(32);
    identity[0] = 1;
    const forged = new Uint8Array(64);
    forged[0] = 1;
    const b64url = (bytes: Uint8Array): string => Buffer.from(bytes).toString('base64url');
    const { api, calls } = cloudflare();
    const headers = { 'stage-key': b64url(identity), 'stage-timestamp': String(NOW / 1000), 'stage-signature': b64url(forged), 'content-length': String(CODE.length) };
    expect((await run(new Request(URL_NODES, { method: 'PUT', body: CODE, headers }), api)).status).toBe(401);
    expect(calls).toEqual([]);
  });

  test('a namespace answer without a script count still lets a node in', async () => {
    const key = newNodeKey();
    const { api, calls } = cloudflare({ 'GET ': () => Response.json({ success: true, result: {} }) });
    expect((await run(signed('PUT', key, CODE), api)).status).toBe(200);
    expect(calls.map(call => call.method)).toEqual(['GET', 'PUT']);
  });

  test('the proxy limits publishes per IPv6 /64 and in all', async () => {
    const keys: string[] = [];
    const allow = { limit: ({ key }: { key: string }) => { keys.push(key); return Promise.resolve({ success: true }); } };
    const deny = { limit: ({ key }: { key: string }) => { keys.push(key); return Promise.resolve({ success: false }); } };
    const env = { NODES_API_TOKEN: TOKEN, NODES_ACCOUNT_ID: ACCOUNT, NODE_PUBLISHES: allow, NODE_PUBLISHES_ALL: deny } as unknown as Parameters<typeof worker.fetch>[1];
    const request = signed('PUT', newNodeKey(), CODE, Date.now());
    const withIp = new Request(request, { headers: { ...Object.fromEntries(request.headers), 'cf-connecting-ip': '2001:db8:1:2:aaaa::1' } });
    const res = await worker.fetch(withIp, env, {} as ExecutionContext);
    expect(res.status).toBe(429);
    expect(keys).toEqual(['2001:db8:1:2::/64', 'all']);
  });
});

describe('deleting a node', () => {
  test('removes only the node of the signing key', async () => {
    const key = newNodeKey();
    const { api, calls } = cloudflare({ [`DELETE /scripts/node-${idOf(key)}`]: () => Response.json({ success: true, result: null }) });
    const res = await run(signed('DELETE', key), api);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: idOf(key) });
    expect(calls.map(call => `${call.method} ${call.url}`)).toEqual([`DELETE ${API_BASE}/scripts/node-${idOf(key)}`]);
  });

  test('says when there is no such node and refuses a bad signature', async () => {
    const key = newNodeKey();
    const missing = cloudflare({ [`DELETE /scripts/node-${idOf(key)}`]: () => Response.json({ success: false }, { status: 404 }) });
    expect((await run(signed('DELETE', key), missing.api)).status).toBe(404);
    const forged = new Headers(signed('DELETE', key).headers);
    forged.set('stage-key', nodeKeyId(newNodeKey()));
    const { api, calls } = cloudflare();
    expect((await run(new Request(URL_NODES, { method: 'DELETE', headers: forged }), api)).status).toBe(401);
    expect((await run(signed('PUT', key, CODE), api)).status).toBe(200);
    expect(calls.some(call => call.method === 'DELETE')).toBe(false);
  });
});
