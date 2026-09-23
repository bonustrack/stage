export type HeaderMap = Record<string, string>;

const SERVED_BY: HeaderMap = { 'x-served-by': 'worker' };

export function corsHeaders(methods: string, allowHeaders = 'content-type'): HeaderMap {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': methods,
    'access-control-allow-headers': allowHeaders,
    'access-control-max-age': '86400',
  };
}

export function jsonResponse(body: unknown, status: number, headers: HeaderMap): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { 'content-type': 'application/json; charset=utf-8', ...SERVED_BY, ...headers },
  });
}

export function corsResponse(
  cors: HeaderMap, body: BodyInit | null, status: number, contentType?: string | null,
): Response {
  const headers: HeaderMap = { ...cors, ...SERVED_BY };
  if (contentType) headers['content-type'] = contentType;
  return new Response(body, { status, headers });
}
