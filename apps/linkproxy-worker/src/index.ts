/** Metro link-preview metadata Worker (preview.metro.box).
 *
 *  A Cloudflare Worker port of apps/linkproxy: given an arbitrary http(s) URL it
 *  fetches the page at the edge, parses OpenGraph / Twitter-card / <title> /
 *  meta description / favicon, and returns a compact JSON card the app renders.
 *  When the URL answers HTTP 402 with an x402 payment challenge it surfaces the
 *  normalised challenge instead, so the chat can render an x402 payment card.
 *
 *  Same API contract as the Node service:
 *    GET /health                 -> "ok"
 *    GET /preview?url=<encoded>  -> { url, title, description, image, siteName,
 *                                     favicon }  OR  an x402 challenge object.
 *
 *  Zero laptop dependency: runs on Cloudflare's edge, no origin/tunnel. Every
 *  response carries `x-served-by: worker` so callers can prove it's the Worker
 *  and not the legacy cloudflared tunnel answering.
 *
 *  Caching: successful results are cached in `caches.default` (the edge cache)
 *  keyed by the normalised request, TTL ~1 day. SSRF: see ssrf.ts - the Workers
 *  runtime refuses to route fetch() to private addresses, so we only keep the
 *  host-allowlist + literal-IP guard. */

import { fetchPage } from './fetchPage.ts';
import { parseMeta } from './parse.ts';
import { SsrfError } from './ssrf.ts';

const CACHE_TTL = 24 * 60 * 60; // 1 day, in seconds

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
  const ip = request.headers.get('cf-connecting-ip')
    ?? request.headers.get('x-forwarded-for')?.split(',')[0].trim()
    ?? 'unknown';
  if (rateLimited(ip)) return json({ error: 'rate limited' }, 429);

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
    const payload = 'kind' in page ? page : parseMeta(page.html, page.finalUrl);
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

export default {
  async fetch(request: Request, _env: unknown, ctx: ExecutionContext): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === '/health') {
      return new Response('ok', { headers: { 'content-type': 'text/plain', ...BASE_HEADERS } });
    }
    if (pathname === '/preview') return handlePreview(request, ctx);
    return json({ error: 'not found' }, 404);
  },
};
