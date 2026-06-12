/** Metro link-preview metadata Worker (preview.metro.box).
 *
 *  The Metro proxy (apps/proxy): given an arbitrary http(s) URL it
 *  fetches the page at the edge, parses OpenGraph / Twitter-card / <title> /
 *  meta description / favicon, and returns a compact JSON card the app renders.
 *  When the URL answers HTTP 402 with an x402 payment challenge it surfaces the
 *  normalised challenge instead, so the chat can render an x402 payment card.
 *
 *  Same API contract as the Node service:
 *    GET /health                 -> "ok"
 *    GET /preview?url=<encoded>  -> { url, title, description, image, siteName,
 *                                     favicon, imageOrigin?, faviconOrigin? }
 *                                   OR an x402 challenge object.
 *    GET /img?url=<encoded>&w=<px> -> the proxied (optionally resized) image.
 *
 *  Image proxy: /preview rewrites og:image + favicon to /img URLs so the app
 *  never loads assets straight from origin sites (which would leak the reader's
 *  IP). /img fetches them at the edge behind the same SSRF guards and attempts a
 *  Cloudflare Image Resizing pass.
 *
 *  Zero laptop dependency: runs on Cloudflare's edge, no origin/tunnel. Every
 *  response carries `x-served-by: worker` so callers can prove it's the Worker
 *  and not the legacy cloudflared tunnel answering.
 *
 *  Caching: successful results are cached in `caches.default` (the edge cache)
 *  keyed by the normalised request (preview ~1 day, images ~7 days). SSRF: see
 *  ssrf.ts - the Workers runtime refuses to route fetch() to private addresses,
 *  so we only keep the host-allowlist + literal-IP guard. */

import { fetchPage } from './fetchPage.ts';
import { fetchImage, parseWidth } from './fetchImage.ts';
import { parseMeta } from './parse.ts';
import { proxyPreviewImages } from './imgProxy.ts';
import { parseSettleBody, settleX402 } from './settle.ts';
import { SsrfError } from './ssrf.ts';

const CACHE_TTL = 24 * 60 * 60; // 1 day, in seconds
const IMG_CACHE_TTL = 7 * 24 * 60 * 60; // 7 days, in seconds

// Cheap abuse barrier: /preview + /img require a header the app sets on its
// proxy fetches. Casual scrapers hitting the public hostname without it are
// rejected. Not a security boundary (the header is trivially forgeable) - just
// a bandwidth/abuse speed-bump on top of the per-IP rate limit + SSRF guards.
const CLIENT_HEADER = 'x-stage-client';
function hasClientHeader(request: Request): boolean {
  return request.headers.get(CLIENT_HEADER) === '1';
}

// Light best-effort per-IP rate limit. Worker isolates are ephemeral and there
// are many of them, so this only bounds bursts within a single isolate - it is
// NOT a hard global limit (use Cloudflare Rate Limiting Rules for that). Kept to
// mirror the Node service's "be a good citizen" 60/min posture.
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
    ?? request.headers.get('x-forwarded-for')?.split(',')[0].trim()
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

async function handlePreview(request: Request, ctx: ExecutionContext): Promise<Response> {
  if (!hasClientHeader(request)) return json({ error: 'forbidden' }, 403);
  if (rateLimited(clientIp(request))) return json({ error: 'rate limited' }, 429);

  const url = new URL(request.url).searchParams.get('url')?.trim() ?? '';
  if (!url) return json({ error: 'url query param required' }, 400);

  // Edge cache lookup, keyed by the normalised preview request (not the upstream
  // url) so the cache key is stable + can't be poisoned by header variance.
  const cache = caches.default;
  const cacheKey = new Request(`https://preview.metro.box/preview?url=${encodeURIComponent(url)}`);
  const hit = await cache.match(cacheKey);
  if (hit) {
    const h = new Headers(hit.headers);
    h.set('x-cache', 'HIT');
    return new Response(hit.body, { status: hit.status, headers: h });
  }

  try {
    const page = await fetchPage(url);
    if (!page) return json({ error: 'no previewable content' }, 422);
    // x402 challenge or OpenGraph card - both are cacheable success results.
    // For OG cards, rewrite image + favicon to proxied /img URLs so the app
    // never beacons the reader's IP to origin sites (originals kept as *Origin).
    const selfOrigin = new URL(request.url).origin;
    const payload = 'kind' in page
      ? page
      : proxyPreviewImages(parseMeta(page.html, page.finalUrl), selfOrigin);
    const res = json(payload, 200, {
      'x-cache': 'MISS',
      'cache-control': `public, max-age=${CACHE_TTL}`,
    });
    ctx.waitUntil(cache.put(cacheKey, res.clone()));
    return res;
  } catch (e) {
    if (e instanceof SsrfError) return json({ error: e.message }, 400);
    const msg = e instanceof Error ? e.message : 'fetch failed';
    return json({ error: msg }, 502);
  }
}

async function handleImg(request: Request, ctx: ExecutionContext): Promise<Response> {
  if (!hasClientHeader(request)) return json({ error: 'forbidden' }, 403);
  if (rateLimited(clientIp(request))) return json({ error: 'rate limited' }, 429);

  const params = new URL(request.url).searchParams;
  const url = params.get('url')?.trim() ?? '';
  if (!url) return json({ error: 'url query param required' }, 400);
  const width = parseWidth(params.get('w'));

  // Edge cache, keyed by the normalised url+width so the same asset at the same
  // width is served from cache (no header variance / poisoning).
  const cache = caches.default;
  const cacheKey = new Request(
    `https://preview.metro.box/img?url=${encodeURIComponent(url)}&w=${width ?? ''}`,
  );
  const hit = await cache.match(cacheKey);
  if (hit) {
    const h = new Headers(hit.headers);
    h.set('x-cache', 'HIT');
    return new Response(hit.body, { status: hit.status, headers: h });
  }

  try {
    const img = await fetchImage(url, width);
    if (!img) return json({ error: 'not a fetchable image' }, 422);
    // Strip ALL upstream headers; only forward a sanitised content-type. No
    // upstream caching/cookie/etag headers leak through.
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
    ctx.waitUntil(cache.put(cacheKey, res.clone()));
    return res;
  } catch (e) {
    if (e instanceof SsrfError) return json({ error: e.message }, 400);
    const msg = e instanceof Error ? e.message : 'fetch failed';
    return json({ error: msg }, 502);
  }
}

// POST /x402-settle { url, paymentHeader }: replay the GET to <url> with the
// caller's signed X-PAYMENT header server-side (behind the SSRF guards) so the
// upstream verifies + settles. Used by the x402 app worker, which can't make the
// settle fetch from the device under our IP-privacy posture. Not cached.
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
    if (e instanceof SsrfError) return json({ error: e.message }, 400);
    const msg = e instanceof Error ? e.message : 'settle failed';
    return json({ error: msg }, 502);
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
