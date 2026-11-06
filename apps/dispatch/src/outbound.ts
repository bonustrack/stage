import { isPublicHost, type HostPolicy } from '@stage-labs/client/net/publicHost';

const NODE_HOST_POLICY: HostPolicy = { ipLiterals: false, blockedDomains: ['stage.box'] };

function parsedUrl(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

export function allowedTarget(raw: string): boolean {
  const url = parsedUrl(raw);
  if (url === null || url.protocol !== 'https:' || url.port !== '' || url.username !== '' || url.password !== '') return false;
  return isPublicHost(url.hostname, NODE_HOST_POLICY);
}

export function outbound(request: Request): Promise<Response> {
  if (!allowedTarget(request.url))
    return Promise.resolve(Response.json({ error: 'nodes can only call public https hosts' }, { status: 403 }));
  return fetch(request.url, { method: request.method, headers: request.headers, body: request.body, redirect: 'manual' });
}

export default { fetch: (request: Request): Promise<Response> => outbound(request) };
