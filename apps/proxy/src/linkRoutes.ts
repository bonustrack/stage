import { PROXY_ORIGIN, PROXY_ROUTES, isStageClient } from '@stage-labs/client/endpoints';
import { fetchPage } from './fetchPage.ts';
import { fetchImage, parseWidth } from './fetchImage.ts';
import { parseMeta } from './parse.ts';
import { proxyPreviewImages } from './imgProxy.ts';
import { parseSettleBody, settleX402 } from './settle.ts';
import { SsrfError } from './ssrf.ts';
import { OPEN_CORS, RATE_LIMITED, corsResponse, guarded, openJson as json } from './respond.ts';

const CACHE_TTL = 24 * 60 * 60;
const IMG_CACHE_TTL = 7 * 24 * 60 * 60;

export type Limited = () => Promise<boolean>;

function errorResponse(e: unknown, fallback: string): Response {
  if (e instanceof SsrfError) return json({ error: e.message }, 400);
  return json({ error: e instanceof Error ? e.message : fallback }, 502);
}

function previewPayload(page: NonNullable<Awaited<ReturnType<typeof fetchPage>>>, request: Request): unknown {
  if ('kind' in page) return page;
  const selfOrigin = new URL(request.url).origin;
  return proxyPreviewImages(parseMeta(page.html, page.finalUrl), selfOrigin);
}

async function cached(cacheUrl: string, ctx: ExecutionContext, fresh: () => Promise<Response>): Promise<Response> {
  const cacheKey = new Request(cacheUrl);
  const hit = await caches.default.match(cacheKey);
  if (hit) {
    const headers = new Headers(hit.headers);
    headers.set('x-cache', 'HIT');
    return new Response(hit.body, { status: hit.status, headers });
  }
  return guarded(
    async () => {
      const res = await fresh();
      if (res.status === 200) ctx.waitUntil(caches.default.put(cacheKey, res.clone()));
      return res;
    },
    (e) => errorResponse(e, 'fetch failed'),
  );
}

export async function handlePreview(request: Request, ctx: ExecutionContext, limited: Limited): Promise<Response> {
  if (!isStageClient(request.headers)) return json({ error: 'forbidden' }, 403);
  if (await limited()) return RATE_LIMITED();
  const url = new URL(request.url).searchParams.get('url')?.trim() ?? '';
  if (!url) return json({ error: 'url query param required' }, 400);
  return cached(`${PROXY_ORIGIN}${PROXY_ROUTES.preview}?url=${encodeURIComponent(url)}`, ctx, async () => {
    const page = await fetchPage(url);
    if (!page) return json({ error: 'no previewable content' }, 422);
    return json(previewPayload(page, request), 200, { 'x-cache': 'MISS', 'cache-control': `public, max-age=${CACHE_TTL}` });
  });
}

export function handleImg(request: Request, ctx: ExecutionContext): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const url = params.get('url')?.trim() ?? '';
  if (!url) return Promise.resolve(json({ error: 'url query param required' }, 400));
  const width = parseWidth(params.get('w'));
  return cached(`${PROXY_ORIGIN}${PROXY_ROUTES.img}?url=${encodeURIComponent(url)}&w=${width ?? ''}`, ctx, async () => {
    const img = await fetchImage(url, width);
    if (!img) return json({ error: 'not a fetchable image' }, 422);
    const headers = {
      ...OPEN_CORS,
      'cache-control': `public, max-age=${IMG_CACHE_TTL}`,
      'x-cache': 'MISS',
      'x-img-resized': img.resized ? '1' : '0',
    };
    return corsResponse(headers, img.body, 200, img.contentType);
  });
}

export async function handleSettle(request: Request, limited: Limited): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  if (await limited()) return RATE_LIMITED();
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return json({ error: 'invalid json body' }, 400);
  }
  const req = parseSettleBody(parsed);
  if (!req) return json({ error: 'url and paymentHeader required' }, 400);
  return guarded(
    async () => json(await settleX402(req), 200),
    (e) => errorResponse(e, 'settle failed'),
  );
}
