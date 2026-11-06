import { STAGE_CLIENT_HEADER } from '@stage-labs/client/endpoints';

export type HeaderMap = Record<string, string>;

const SERVED_BY: HeaderMap = { 'x-served-by': 'worker' };

export const OPEN_CORS: HeaderMap = { 'access-control-allow-origin': '*' };

export function corsHeaders(methods: string, allowHeaders = 'content-type'): HeaderMap {
  return {
    ...OPEN_CORS,
    'access-control-allow-methods': methods,
    'access-control-allow-headers': allowHeaders,
    'access-control-max-age': '86400',
  };
}

export const CLIENT_CORS = corsHeaders('GET, POST, OPTIONS', `content-type, ${STAGE_CLIENT_HEADER}`);

export function jsonResponse(body: unknown, status: number, headers: HeaderMap): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...SERVED_BY, ...headers },
  });
}

export function openJson(body: unknown, status = 200, extra: HeaderMap = {}): Response {
  return jsonResponse(body, status, { ...OPEN_CORS, ...extra });
}

export function corsResponse(cors: HeaderMap, body: BodyInit | null, status: number, contentType?: string | null): Response {
  const headers: HeaderMap = { ...cors, ...SERVED_BY };
  if (contentType) headers['content-type'] = contentType;
  return new Response(body, { status, headers });
}

export interface Replies {
  json: (body: unknown, status?: number) => Response;
  fail: (status: number, error: string) => Response;
  text: (body: string | null, status: number) => Response;
}

export function repliesWith(cors: HeaderMap): Replies {
  return {
    json: (body, status = 200) => jsonResponse(body, status, cors),
    fail: (status, error) => jsonResponse({ error }, status, cors),
    text: (body, status) => corsResponse(cors, body, status, body === null ? null : 'text/plain'),
  };
}

export async function guarded(work: () => Promise<Response>, failure: (error: unknown) => Response): Promise<Response> {
  try {
    return await work();
  } catch (error) {
    return failure(error);
  }
}

export function declaredLength(request: Request): number | null {
  const raw = request.headers.get('content-length');
  const size = raw === null ? Number.NaN : Number(raw);
  return Number.isSafeInteger(size) && size >= 0 ? size : null;
}
