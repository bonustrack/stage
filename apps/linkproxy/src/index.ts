/** Metro link-preview metadata proxy (preview.metro.box).
 *
 *  An iframely-style Express service: given an arbitrary http(s) URL it fetches
 *  the page server-side, parses OpenGraph / Twitter-card / <title> / meta
 *  description / favicon, and returns a compact JSON card the app can render.
 *
 *  Standalone Express app (kept out of ~/.metro/trains/ so the metro daemon
 *  doesn't supervise/restart it — same convention as apps/api). Front it with a
 *  cloudflared named tunnel -> this port; see README.md.
 *
 *  Endpoints:
 *    GET /health                 -> "ok"
 *    GET /preview?url=<encoded>  -> { url, title, description, image, siteName, favicon }
 *
 *  Security: see ssrf.ts (DNS-resolved private-range + internal-host blocking,
 *  cookie stripping, no JS execution, timeout, body cap, redirect cap) plus the
 *  light per-IP rate limit below. */

import express, { type Request, type Response } from 'express';

import { getCached, loadCache, setCached } from './cache.ts';
import { fetchPage } from './fetchPage.ts';
import { parseMeta } from './parse.ts';
import { SsrfError } from './ssrf.ts';

const PORT = Number(process.env.LINKPROXY_PORT ?? '8600');

// --- light fixed-window per-IP rate limit (no dep) ---
const RL_WINDOW_MS = 60_000;
const RL_MAX = 60; // 60 previews / IP / minute
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
// Sweep stale buckets occasionally so the map can't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of hits) if (now > v.reset) hits.delete(k);
}, RL_WINDOW_MS).unref();

const app = express();
app.disable('x-powered-by');

app.get('/health', (_req: Request, res: Response) => {
  res.type('text/plain').send('ok');
});

app.get('/preview', async (req: Request, res: Response) => {
  res.set('Access-Control-Allow-Origin', '*');

  const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim())
    || req.socket.remoteAddress || 'unknown';
  if (rateLimited(ip)) {
    res.status(429).json({ error: 'rate limited' });
    return;
  }

  const url = typeof req.query.url === 'string' ? req.query.url.trim() : '';
  if (!url) {
    res.status(400).json({ error: 'url query param required' });
    return;
  }

  const cached = getCached(url);
  if (cached) {
    res.set('X-Cache', 'HIT').json(cached);
    return;
  }

  try {
    const page = await fetchPage(url);
    if (!page) {
      res.status(422).json({ error: 'no previewable content' });
      return;
    }
    const meta = parseMeta(page.html, page.finalUrl);
    setCached(url, meta);
    res.set('X-Cache', 'MISS').json(meta);
  } catch (e) {
    if (e instanceof SsrfError) {
      res.status(400).json({ error: e.message });
      return;
    }
    const msg = e instanceof Error ? e.message : 'fetch failed';
    res.status(502).json({ error: msg });
  }
});

async function main(): Promise<void> {
  await loadCache();
  app.listen(PORT, () => {
    process.stderr.write(`metro linkproxy listening on :${PORT}\n`);
  });
}

void main();
