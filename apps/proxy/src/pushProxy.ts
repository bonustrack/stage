import { PROXY_ROUTES, PUSH_ORIGIN } from '@stage-labs/client/endpoints';
import { isPushRpc, pushRpcPath } from '@stage-labs/client/xmtp/pushServer';
import { corsHeaders, corsResponse, repliesWith } from './respond.ts';

const PUSH_PREFIX = PROXY_ROUTES.push;
const MAX_BODY_BYTES = 2_000_000;
const UPSTREAM_TIMEOUT_MS = 20_000;

export const PUSH_CORS_HEADERS = corsHeaders('POST, OPTIONS');
const { text } = repliesWith(PUSH_CORS_HEADERS);

export function parsePushRoute(pathname: string, method: string): string | null {
  if (!pathname.startsWith(PUSH_PREFIX) || method !== 'POST') return null;
  const rpc = pathname.slice(PUSH_PREFIX.length);
  return isPushRpc(rpc) ? `${PUSH_ORIGIN}${pushRpcPath(rpc)}` : null;
}

export async function handlePush(request: Request): Promise<Response> {
  const upstreamUrl = parsePushRoute(new URL(request.url).pathname, request.method);
  if (upstreamUrl === null) return text('not found', 404);
  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) return text('body too large', 413);
  const upstream = await fetch(upstreamUrl, {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json' },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  return corsResponse(PUSH_CORS_HEADERS, upstream.body, upstream.status, upstream.headers.get('content-type'));
}
