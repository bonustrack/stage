import { NODE_REPLY_MAX_BYTES, clientRateKey, isNodeId, nodeScriptName } from '@stage-labs/client/nodes/hosting';

export const NODE_LIMITS = { cpuMs: 50, subRequests: 5 };
export const REQUEST_MAX_BYTES = 64 * 1024;
const NODE_TIMEOUT_MS = 10_000;
const NULL_BODY = new Set([204, 205]);
const CALLER_HEADERS = [
  'cookie', 'cf-connecting-ip', 'cf-connecting-ipv6', 'true-client-ip', 'x-forwarded-for', 'x-real-ip', 'cf-ipcountry', 'cf-ipcity',
  'cf-ipcontinent', 'cf-iplatitude', 'cf-iplongitude', 'cf-region', 'cf-region-code', 'cf-metro-code', 'cf-postal-code', 'cf-timezone',
  'cf-ray',
];

const HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type, stage-key, stage-timestamp, stage-signature',
  'access-control-max-age': '86400',
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'; sandbox",
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-served-by': 'dispatch',
};

export interface DispatchDeps {
  nodes?: DispatchNamespace;
  limiter?: RateLimit;
  nodeLimiter?: RateLimit;
  timeoutMs?: number;
}

interface DispatchEnv {
  NODES?: DispatchNamespace;
  NODE_REQUESTS?: RateLimit;
  NODE_CALLS?: RateLimit;
}

const answer = (body: BodyInit | null, status: number): Response => new Response(body, { status, headers: HEADERS });
const fail = (status: number, error: string): Response => answer(JSON.stringify({ error }), status);

function bodyTooLarge(request: Request): boolean {
  if (request.body === null) return false;
  const raw = request.headers.get('content-length');
  const size = raw === null ? Number.NaN : Number(raw);
  return !(Number.isSafeInteger(size) && size >= 0 && size <= REQUEST_MAX_BYTES);
}

async function over(limiter: RateLimit | undefined, key: string): Promise<boolean> {
  return limiter !== undefined && !(await limiter.limit({ key })).success;
}

async function limited(request: Request, id: string, deps: DispatchDeps): Promise<boolean> {
  return await over(deps.limiter, clientRateKey(request.headers.get('cf-connecting-ip') ?? 'unknown')) || over(deps.nodeLimiter, id);
}

async function cappedBody(response: Response): Promise<Blob | null> {
  if (Number(response.headers.get('content-length') ?? 0) > NODE_REPLY_MAX_BYTES) return null;
  const reader: ReadableStreamDefaultReader<Uint8Array> | undefined = response.body?.getReader();
  if (reader === undefined) return new Blob([]);
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (let part = await reader.read(); !part.done; part = await reader.read()) {
    size += part.value.byteLength;
    if (size > NODE_REPLY_MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(part.value);
  }
  return new Blob(chunks);
}

const passable = (status: number): boolean => (status >= 200 && status < 300) || (status >= 400 && status < 600);

async function relay(response: Response): Promise<Response> {
  if (!passable(response.status)) return fail(502, 'node answered with a redirect or an upgrade');
  const body = await cappedBody(response);
  if (body === null) return fail(502, 'node reply too large');
  return answer(NULL_BODY.has(response.status) ? null : body, response.status);
}

function anonymous(request: Request): Request {
  const headers = new Headers(request.headers);
  for (const name of CALLER_HEADERS) headers.delete(name);
  return new Request(request, { headers });
}

async function runNode(nodes: DispatchNamespace, id: string, request: Request): Promise<Response> {
  try {
    return await relay(await nodes.get(nodeScriptName(id), {}, { limits: NODE_LIMITS }).fetch(anonymous(request)));
  } catch (err) {
    return err instanceof Error && err.message.startsWith('Worker not found') ? fail(404, 'no such node') : fail(502, 'node failed');
  }
}

function withTimeout(work: Promise<Response>, ms: number): Promise<Response> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => { resolve(fail(504, 'node timed out')); }, ms);
    void work.then((response) => {
      clearTimeout(timer);
      resolve(response);
    });
  });
}

function refused(request: Request, id: string): Response | null {
  if (!isNodeId(id)) return fail(404, 'not found');
  if (request.method !== 'GET' && request.method !== 'POST') return fail(405, 'method not allowed');
  if (request.headers.has('cf-worker')) return fail(403, 'nodes do not answer other Workers');
  return bodyTooLarge(request) ? fail(413, 'request too large') : null;
}

export async function dispatchNode(request: Request, deps: DispatchDeps): Promise<Response> {
  if (request.method === 'OPTIONS') return answer(null, 204);
  const id = new URL(request.url).pathname.split('/')[1] ?? '';
  const refusal = refused(request, id);
  if (refusal !== null) return refusal;
  const { nodes } = deps;
  if (nodes === undefined) return fail(503, 'nodes are not set up');
  if (await limited(request, id, deps)) return fail(429, 'rate limited');
  return withTimeout(runNode(nodes, id, request), deps.timeoutMs ?? NODE_TIMEOUT_MS);
}

export default {
  fetch: (request: Request, env: DispatchEnv): Promise<Response> => dispatchNode(request, {
    nodes: env.NODES, limiter: env.NODE_REQUESTS, nodeLimiter: env.NODE_CALLS,
  }),
};
