const BLOCKED_NAMES = new Set(['stage.box', 'localhost']);
const BLOCKED_SUFFIXES = ['.stage.box', '.localhost', '.local', '.localdomain', '.internal', '.lan', '.home.arpa'];
const IPV4 = /^[\d.]+$/;

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
  const host = url.hostname.toLowerCase().replace(/\.+$/, '');
  if (host.startsWith('[') || IPV4.test(host) || !host.includes('.')) return false;
  return !BLOCKED_NAMES.has(host) && !BLOCKED_SUFFIXES.some(suffix => host.endsWith(suffix));
}

export function outbound(request: Request): Promise<Response> {
  if (!allowedTarget(request.url)) return Promise.resolve(Response.json({ error: 'nodes can only call public https hosts' }, { status: 403 }));
  return fetch(request.url, { method: request.method, headers: request.headers, body: request.body, redirect: 'manual' });
}

export default {
  fetch: (request: Request): Promise<Response> => outbound(request),
};
