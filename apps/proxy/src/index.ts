
import { fetchPage } from './fetchPage.ts';
import { fetchImage, parseWidth } from './fetchImage.ts';
import { parseMeta } from './parse.ts';
import { proxyPreviewImages } from './imgProxy.ts';
import { parseSettleBody, settleX402 } from './settle.ts';
import { SsrfError } from './ssrf.ts';

const CACHE_TTL = 24 * 60 * 60;
const IMG_CACHE_TTL = 7 * 24 * 60 * 60;

const CLIENT_HEADER = 'x-stage-client';
function hasClientHeader(request: Request): boolean {
  return request.headers.get(CLIENT_HEADER) === '1';
}

const RL_WINDOW_MS = 60_000;
const RL_MAX = 60;
const hits = new Map<string, { count: number; reset: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const e = hits.get(ip);
  if (!e || now > e.reset) {
    hits.set(ip, { count: 1, reset: now + RL_WINDOW_MS });
    return false;
  }
  e.count++;
  return e.count > RL_MAX;
}

function clientIp(request: Request): string {
  return request.headers.get('cf-connecting-ip')
    ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? 'unknown';
}

const BASE_HEADERS = {
  'x-served-by': 'worker',
  'access-control-allow-origin': '*',
};

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...BASE_HEADERS, ...extra },
  });
}

async function cacheHit(cacheKey: Request): Promise<Response | null> {
  const hit = await caches.default.match(cacheKey);
  if (!hit) return null;
  const h = new Headers(hit.headers);
  h.set('x-cache', 'HIT');
  return new Response(hit.body, { status: hit.status, headers: h });
}

function errorResponse(e: unknown, fallback: string): Response {
  if (e instanceof SsrfError) return json({ error: e.message }, 400);
  return json({ error: e instanceof Error ? e.message : fallback }, 502);
}

function previewPayload(page: NonNullable<Awaited<ReturnType<typeof fetchPage>>>, request: Request): unknown {
  if ('kind' in page) return page;
  const selfOrigin = new URL(request.url).origin;
  return proxyPreviewImages(parseMeta(page.html, page.finalUrl), selfOrigin);
}

async function handlePreview(request: Request, ctx: ExecutionContext): Promise<Response> {
  if (!hasClientHeader(request)) return json({ error: 'forbidden' }, 403);
  if (rateLimited(clientIp(request))) return json({ error: 'rate limited' }, 429);

  const url = new URL(request.url).searchParams.get('url')?.trim() ?? '';
  if (!url) return json({ error: 'url query param required' }, 400);

  const cacheKey = new Request(`https://preview.metro.box/preview?url=${encodeURIComponent(url)}`);
  const cached = await cacheHit(cacheKey);
  if (cached) return cached;

  try {
    const page = await fetchPage(url);
    if (!page) return json({ error: 'no previewable content' }, 422);
    const res = json(previewPayload(page, request), 200, {
      'x-cache': 'MISS',
      'cache-control': `public, max-age=${CACHE_TTL}`,
    });
    ctx.waitUntil(caches.default.put(cacheKey, res.clone()));
    return res;
  } catch (e) {
    return errorResponse(e, 'fetch failed');
  }
}

async function handleImg(request: Request, ctx: ExecutionContext): Promise<Response> {
  if (rateLimited(clientIp(request))) return json({ error: 'rate limited' }, 429);

  const params = new URL(request.url).searchParams;
  const url = params.get('url')?.trim() ?? '';
  if (!url) return json({ error: 'url query param required' }, 400);
  const width = parseWidth(params.get('w'));

  const cacheKey = new Request(
    `https://preview.metro.box/img?url=${encodeURIComponent(url)}&w=${width ?? ''}`,
  );
  const cached = await cacheHit(cacheKey);
  if (cached) return cached;

  try {
    const img = await fetchImage(url, width);
    if (!img) return json({ error: 'not a fetchable image' }, 422);
    const res = new Response(img.body, {
      status: 200,
      headers: {
        'content-type': img.contentType,
        'cache-control': `public, max-age=${IMG_CACHE_TTL}`,
        'x-cache': 'MISS',
        'x-img-resized': img.resized ? '1' : '0',
        ...BASE_HEADERS,
      },
    });
    ctx.waitUntil(caches.default.put(cacheKey, res.clone()));
    return res;
  } catch (e) {
    return errorResponse(e, 'fetch failed');
  }
}

async function handleSettle(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  if (rateLimited(clientIp(request))) return json({ error: 'rate limited' }, 429);

  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return json({ error: 'invalid json body' }, 400);
  }
  const req = parseSettleBody(parsed);
  if (!req) return json({ error: 'url and paymentHeader required' }, 400);

  try {
    const result = await settleX402(req);
    return json(result, 200);
  } catch (e) {
    return errorResponse(e, 'settle failed');
  }
}

export default {
  async fetch(request: Request, _env: unknown, ctx: ExecutionContext): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === '/health') {
      return new Response('ok', { headers: { 'content-type': 'text/plain', ...BASE_HEADERS } });
    }
    if (pathname === '/preview') return handlePreview(request, ctx);
    if (pathname === '/img') return handleImg(request, ctx);
    if (pathname === '/x402-settle') return handleSettle(request);
    return json({ error: 'not found' }, 404);
  },
};
