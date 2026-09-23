import { readCappedBytes } from './ssrf.ts';
import { corsHeaders, corsResponse } from './respond.ts';

export const HISTORY_PREFIX = '/xmtp-history/';

const UPSTREAMS: Record<string, string> = {
  production: 'https://message-history.production.ephemera.network',
  dev: 'https://message-history.dev.ephemera.network',
};

const MAX_ARCHIVE_BYTES = 50_000_000;
const UPSTREAM_TIMEOUT_MS = 60_000;
const FILE_ID = /^[A-Za-z0-9_-]{1,128}$/;

const HISTORY_CORS_HEADERS = corsHeaders('GET, POST, OPTIONS');

interface HistoryRoute {
  upstream: string;
  method: 'GET' | 'POST';
}

function uploadRoute(base: string, kind: string | undefined, id: string | undefined, method: string): HistoryRoute | null {
  if (kind !== 'upload' || id !== undefined || method !== 'POST') return null;
  return { upstream: `${base}/upload`, method: 'POST' };
}

function fileRoute(base: string, kind: string | undefined, id: string | undefined, method: string): HistoryRoute | null {
  if (kind !== 'files' || id === undefined || !FILE_ID.test(id) || method !== 'GET') return null;
  return { upstream: `${base}/files/${id}`, method: 'GET' };
}

export function parseHistoryRoute(pathname: string, method: string): HistoryRoute | null {
  if (!pathname.startsWith(HISTORY_PREFIX)) return null;
  const [env, kind, id, ...rest] = pathname.slice(HISTORY_PREFIX.length).split('/');
  const base = env === undefined ? undefined : UPSTREAMS[env];
  if (base === undefined || rest.length > 0) return null;
  return uploadRoute(base, kind, id, method) ?? fileRoute(base, kind, id, method);
}

async function uploadBody(request: Request): Promise<Uint8Array | null> {
  return readCappedBytes(new Response(request.body), MAX_ARCHIVE_BYTES, 'reject');
}

export async function handleHistory(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return corsResponse(HISTORY_CORS_HEADERS, null, 204);
  const route = parseHistoryRoute(new URL(request.url).pathname, request.method);
  if (route === null) return corsResponse(HISTORY_CORS_HEADERS, 'not found', 404, 'text/plain');
  const body = route.method === 'POST' ? await uploadBody(request) : null;
  if (route.method === 'POST' && body === null) return corsResponse(HISTORY_CORS_HEADERS, 'archive too large', 413, 'text/plain');
  const upstream = await fetch(route.upstream, {
    method: route.method,
    body,
    headers: body === null ? undefined : { 'content-type': request.headers.get('content-type') ?? 'application/octet-stream' },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  return corsResponse(HISTORY_CORS_HEADERS, upstream.body, upstream.status, upstream.headers.get('content-type'));
}
