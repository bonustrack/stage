import {
  NODE_CAPABILITIES_HEADER,
  NODE_LIMITS,
  NODE_REPLY_MAX_BYTES,
  NODE_REQUEST_MAX_BYTES,
  NODE_SIGNATURE_HEADERS,
  NODE_TIMEOUT_MS,
  isNodeId,
  nodeScriptName,
} from '@stage-labs/client/nodes/hosting';
import { declaredLength, readCappedResponse } from '@stage-labs/client/net/cappedBody';
import { clientIp, clientRateKey } from '@stage-labs/client/net/clientIp';
import { settleWithin } from '@stage-labs/client/timing';

const NULL_BODY = new Set([204, 205]);
const CALLER_HEADERS = [
  'cookie',
  'cf-connecting-ip',
  'cf-connecting-ipv6',
  'true-client-ip',
  'x-forwarded-for',
  'x-real-ip',
  'cf-ipcountry',
  'cf-ipcity',
  'cf-ipcontinent',
  'cf-iplatitude',
  'cf-iplongitude',
  'cf-region',
  'cf-region-code',
  'cf-metro-code',
  'cf-postal-code',
  'cf-timezone',
  'cf-ray',
];

const HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': ['content-type', ...Object.values(NODE_SIGNATURE_HEADERS), NODE_CAPABILITIES_HEADER]
    .join(', ')
    .toLowerCase(),
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

const answer = (body: string | Blob | null, status: number): Response => new Response(body, { status, headers: HEADERS });
const fail = (status: number, error: string): Response => answer(JSON.stringify({ error }), status);

function bodyTooLarge(request: Request): boolean {
  if (request.body === null) return false;
  const size = declaredLength(request.headers);
  return size === null || size > NODE_REQUEST_MAX_BYTES;
}

async function over(limiter: RateLimit | undefined, key: string): Promise<boolean> {
  return limiter !== undefined && !(await limiter.limit({ key })).success;
}

async function limited(request: Request, id: string, deps: DispatchDeps): Promise<boolean> {
  return (await over(deps.limiter, clientRateKey(clientIp(request.headers)))) || over(deps.nodeLimiter, id);
}

const passable = (status: number): boolean => (status >= 200 && status < 300) || (status >= 400 && status < 600);

async function relay(response: Response): Promise<Response> {
  if (!passable(response.status)) return fail(502, 'node answered with a redirect or an upgrade');
  const bytes = await readCappedResponse(response, NODE_REPLY_MAX_BYTES);
  if (bytes === null) return fail(502, 'node reply too large');
  return answer(NULL_BODY.has(response.status) ? null : new Blob([bytes]), response.status);
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
  return settleWithin(runNode(nodes, id, request), deps.timeoutMs ?? NODE_TIMEOUT_MS, fail(504, 'node timed out'));
}

export default {
  fetch: (request: Request, env: DispatchEnv): Promise<Response> =>
    dispatchNode(request, { nodes: env.NODES, limiter: env.NODE_REQUESTS, nodeLimiter: env.NODE_CALLS }),
};
