/** Read-only HTTP monitor endpoints. `/api/state` (snapshot) + `/api/tail` (SSE). */
/** Mounted on the webhook server. Bearer auth via METRO_MONITOR_TOKEN (503 when unset). */

import { timingSafeEqual } from 'node:crypto';
import { watch } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { errMsg, log } from './log.js';
import {
  HISTORY_FILE, historySize, passesMode, readClaims, readEntriesFrom, type Mode,
} from './broker.js';
import { readBotIds } from './cache.js';
import { readHistory } from './history.js';
import { asLine, type Line } from './stations/index.js';

const HISTORY_LIMIT = 100;

function authorized(req: IncomingMessage): { ok: true } | { ok: false; status: 401 | 503; msg: string } {
  const token = process.env.METRO_MONITOR_TOKEN;
  if (!token) return { ok: false, status: 503, msg: 'monitor endpoints not configured (METRO_MONITOR_TOKEN unset)' };
  const header = req.headers['authorization'];
  const value = Array.isArray(header) ? header[0] : header;
  if (!value || !value.startsWith('Bearer ')) return { ok: false, status: 401, msg: 'unauthorized' };
  const given = Buffer.from(value.slice('Bearer '.length));
  const want = Buffer.from(token);
  if (given.length !== want.length || !timingSafeEqual(given, want)) {
    return { ok: false, status: 401, msg: 'unauthorized' };
  }
  return { ok: true };
}

/** Hosts that serve `/api/*`. webhook.metro.box stays scoped to /wh/*. */
const MONITOR_HOSTS = new Set<string>(['monitor.metro.box', 'localhost', '127.0.0.1']);

function monitorHostAllowed(req: IncomingMessage): boolean {
  const raw = (req.headers[':authority' as keyof typeof req.headers] as string | undefined) ?? req.headers.host;
  if (!raw) return true;
  return MONITOR_HOSTS.has(raw.split(':')[0].toLowerCase());
}

export function handleMonitorRequest(req: IncomingMessage, res: ServerResponse): boolean {
  const url = req.url ?? '';
  if (!url.startsWith('/api/')) return false;
  if (!monitorHostAllowed(req)) return false; // let outer router 404 it
  const [pathOnly, queryString = ''] = url.split('?', 2);

  if (req.method !== 'GET') {
    res.writeHead(405, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'method not allowed' }));
    return true;
  }

  const auth = authorized(req);
  if (!auth.ok) {
    res.writeHead(auth.status, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: auth.msg }));
    return true;
  }

  const query = new URLSearchParams(queryString);

  if (pathOnly === '/api/state') {
    handleState(res);
    return true;
  }
  if (pathOnly === '/api/tail') {
    handleTail(req, res, query).catch(err => {
      log.warn({ err: errMsg(err) }, 'monitor: tail handler error');
      try { if (!res.headersSent) res.writeHead(500).end(); else res.end(); } catch { /* ignore */ }
    });
    return true;
  }

  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
  return true;
}

function handleState(res: ServerResponse): void {
  /** `readHistory` is newest-first — what the activity feed expects. */
  const recent = readHistory({ limit: HISTORY_LIMIT });
  const claims = readClaims();
  const linesSet = new Set<string>();
  for (const e of recent) linesSet.add(e.line);
  for (const line of Object.keys(claims)) linesSet.add(line);
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ claims, lines: [...linesSet], recent_history: recent, bot_ids: readBotIds() }));
}

/** Mirrors `cli/tail.ts:resolveMode` but operates on URLSearchParams. */
function resolveQueryMode(query: URLSearchParams, self: Line | null): Mode {
  const strict = query.get('strict') === 'true' || query.get('mode') === 'strict';
  const unclaimed = query.get('unclaimed') === 'true' || query.get('mode') === 'unclaimed';
  const all = query.get('all') === 'true' || query.get('mode') === 'all';
  if ([strict, unclaimed, all].filter(Boolean).length > 1) return 'all';
  if (strict && self) return 'mine-only';
  if (unclaimed) return 'unclaimed';
  if (all || !self) return 'all';
  return 'mine-or-unclaimed';
}

async function handleTail(req: IncomingMessage, res: ServerResponse, query: URLSearchParams): Promise<void> {
  const asParam = query.get('as');
  const self = asParam ? asLine(asParam) : null;
  const mode = resolveQueryMode(query, self);
  const chatFilter = query.get('chat');
  const stationFilter = query.get('station');
  const includeWebhooks = query.get('include_webhooks') === 'true';

  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache, no-transform',
    'connection': 'keep-alive',
    /** Bearer auth already gates us; CORS can be permissive. */
    'access-control-allow-origin': '*',
    /** Cloudflare/proxies buffer SSE without this hint. */
    'x-accel-buffering': 'no',
  });

  /** `since=tail` (default) starts at EOF; `since=0` replays the full file. */
  const since = query.get('since');
  let offset = since === '0' ? 0 : historySize();
  if (since && since !== '0' && since !== 'tail') {
    const n = Number(since);
    if (Number.isFinite(n) && n >= 0) offset = n;
  }

  /** 4 KiB padding so Cloudflare's HTTP/2 buffer flushes (else holds 30+ s on free tier). */
  res.write(`: metro monitor tail (mode=${mode}${self ? `, as=${self}` : ''})\n`);
  res.write(`: ${'-'.repeat(4096)}\n\n`);

  const drain = (): void => {
    const claims = readClaims();
    for (const { entry, offset: next } of readEntriesFrom(offset)) {
      offset = next;
      if (chatFilter && entry.line !== chatFilter) continue;
      if (stationFilter && entry.station !== stationFilter) continue;
      if (!passesMode(entry, mode, self, claims, { includeWebhooks })) continue;
      res.write(`id: ${entry.id}\n`);
      res.write('event: history\n');
      res.write(`data: ${JSON.stringify(entry)}\n\n`);
    }
  };

  drain();

  /** fs.watch coalesces on macOS — poll every 1s as a backstop. */
  let watcher: ReturnType<typeof watch> | null = null;
  try { watcher = watch(HISTORY_FILE, () => drain()); } catch { /* file may not exist yet */ }
  const poll = setInterval(drain, 1_000);
  const keepalive = setInterval(() => res.write(': keepalive\n\n'), 25_000);

  const cleanup = (): void => {
    clearInterval(poll);
    clearInterval(keepalive);
    if (watcher) { try { watcher.close(); } catch { /* ignore */ } }
    try { res.end(); } catch { /* ignore */ }
  };
  req.on('close', cleanup);
  req.on('error', cleanup);
}
