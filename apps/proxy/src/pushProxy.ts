export const PUSH_PREFIX = '/xmtp-push/';

const UPSTREAM = 'https://push.stage.box/notifications.v1.Notifications/';
const METHODS = new Set(['RegisterInstallation', 'SubscribeWithMetadata', 'DeleteInstallation']);
const MAX_BODY_BYTES = 2_000_000;
const UPSTREAM_TIMEOUT_MS = 20_000;

const PUSH_CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
};

export function parsePushRoute(pathname: string, method: string): string | null {
  if (!pathname.startsWith(PUSH_PREFIX) || method !== 'POST') return null;
  const rpc = pathname.slice(PUSH_PREFIX.length);
  return METHODS.has(rpc) ? `${UPSTREAM}${rpc}` : null;
}

function corsResponse(body: BodyInit | null, status: number, contentType?: string | null): Response {
  const headers: Record<string, string> = { ...PUSH_CORS_HEADERS, 'x-served-by': 'worker' };
  if (contentType) headers['content-type'] = contentType;
  return new Response(body, { status, headers });
}

export async function handlePush(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return corsResponse(null, 204);
  const upstreamUrl = parsePushRoute(new URL(request.url).pathname, request.method);
  if (upstreamUrl === null) return corsResponse('not found', 404, 'text/plain');
  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) return corsResponse('body too large', 413, 'text/plain');
  const upstream = await fetch(upstreamUrl, {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json' },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  return corsResponse(upstream.body, upstream.status, upstream.headers.get('content-type'));
}
