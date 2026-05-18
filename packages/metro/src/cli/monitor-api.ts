/** HTTP monitor endpoints: GET /api/state, GET /api/tail (SSE). Mounted on the webhook server. */

import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import pkg from '../../package.json' with { type: 'json' };
import { readClaims } from '../broker/claims.js';
import {
  drainTail, followTail, historySize, type Mode, type TailOpts,
} from '../broker/history-stream.js';
import { readHistory, type HistoryEntry } from '../history.js';
import { asLine, Line } from '../lines.js';
import { errMsg, log } from '../log.js';
import { readBotIds } from '../paths.js';

/** Monitor endpoints answer only on dedicated hostnames so webhook tunnel can't double-serve them. */
const MONITOR_HOSTS = new Set(
  (process.env.METRO_MONITOR_HOSTS ?? 'monitor.metro.box,localhost,127.0.0.1')
    .toLowerCase().split(',').map(s => s.trim()).filter(Boolean),
);
const JSON_CT = { 'content-type': 'application/json' };

function jsonRes(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, JSON_CT); res.end(JSON.stringify(body));
}

function authorized(req: IncomingMessage): { status: number; msg: string } | null {
  const token = process.env.METRO_MONITOR_TOKEN;
  if (!token) return { status: 503, msg: 'monitor endpoints not configured (METRO_MONITOR_TOKEN unset)' };
  const value = ([] as string[]).concat(req.headers['authorization'] ?? [])[0];
  if (!value?.startsWith('Bearer ')) return { status: 401, msg: 'unauthorized' };
  const given = Buffer.from(value.slice(7)), want = Buffer.from(token);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return { status: 401, msg: 'unauthorized' };
  return null;
}

/** Mode picker — shared with CLI tail. Conflict/strict-no-self routed through `onErr`. */
export function pickMode(
  strict: boolean, unclaimed: boolean, all: boolean, self: Line | null,
  onErr: (msg: string) => never | Mode,
): Mode {
  if ([strict, unclaimed, all].filter(Boolean).length > 1) {
    return onErr('strict/unclaimed/all are mutually exclusive');
  }
  if (strict) return self ? 'mine-only' : onErr('strict requires --as <user-uri>');
  if (unclaimed) return 'unclaimed';
  if (all || !self) return 'all';
  return 'mine-or-unclaimed';
}

export function handleMonitorRequest(req: IncomingMessage, res: ServerResponse): boolean {
  const url = req.url ?? '';
  if (!url.startsWith('/api/')) return false;
  const host = (req.headers[':authority' as keyof typeof req.headers] as string | undefined) ?? req.headers.host;
  if (host && !MONITOR_HOSTS.has(host.split(':')[0].toLowerCase())) return false;
  const auth = authorized(req);
  if (auth) { jsonRes(res, auth.status, { error: auth.msg }); return true; }
  const [path, qs = ''] = url.split('?', 2);
  const q = new URLSearchParams(qs);
  if (req.method === 'GET' && path === '/api/state') { handleState(res, q); return true; }
  if (req.method === 'GET' && path === '/api/tail') {
    handleTail(req, res, q).catch(err => {
      log.warn({ err: errMsg(err) }, 'monitor: tail handler error');
      try { if (!res.headersSent) res.writeHead(500).end(); else res.end(); } catch { /* ignore */ }
    });
    return true;
  }
  /** GET-only paths reject other verbs with 405. Anything else → 404. */
  if (req.method !== 'GET' && (path === '/api/state' || path === '/api/tail')) {
    jsonRes(res, 405, { error: 'method not allowed' });
    return true;
  }
  jsonRes(res, 404, { error: 'not found' });
  return true;
}

function nonNegInt(raw: string | null): number | null {
  const n = raw == null ? NaN : Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

function handleState(res: ServerResponse, q: URLSearchParams): void {
  const before = nonNegInt(q.get('before'));
  const limit = Math.min(nonNegInt(q.get('limit')) ?? 100, 500);
  if (before !== null) return jsonRes(res, 200, { recent_history: readHistory({ limit, skip: before }) });
  const recent = readHistory({ limit }), claims = readClaims();
  const lines = new Set<string>([...recent.map(e => e.line), ...Object.keys(claims)]);
  jsonRes(res, 200, {
    claims, lines: [...lines], recent_history: recent, bot_ids: readBotIds(), version: pkg.version,
  });
}

async function handleTail(req: IncomingMessage, res: ServerResponse, q: URLSearchParams): Promise<void> {
  const asParam = q.get('as');
  const self = asParam ? asLine(asParam) : null;
  const isOn = (k: string): boolean => q.get(k) === 'true' || q.get('mode') === k;
  const mode = pickMode(isOn('strict'), isOn('unclaimed'), isOn('all'), self, () => 'all');
  const opts: TailOpts = {
    mode, self, chatFilter: q.get('chat') ?? undefined,
    stationFilter: q.get('station') ?? undefined,
    includeWebhooks: q.get('include_webhooks') === 'true',
  };
  res.writeHead(200, {
    'content-type': 'text/event-stream', 'cache-control': 'no-cache, no-transform',
    'connection': 'keep-alive', 'access-control-allow-origin': '*',
    /** Cloudflare/proxies buffer SSE without this hint. */
    'x-accel-buffering': 'no',
  });
  /** `since=tail` (default) starts at EOF; `since=0` replays the full file; numeric = byte offset. */
  const since = q.get('since');
  const sinceN = since && since !== 'tail' ? Number(since) : NaN;
  let offset = Number.isFinite(sinceN) && sinceN >= 0 ? sinceN : historySize();
  /** 4 KiB padding so Cloudflare's HTTP/2 buffer flushes (else holds 30+ s on free tier). */
  res.write(`: metro monitor tail (mode=${opts.mode}${self ? `, as=${self}` : ''})\n: ${'-'.repeat(4096)}\n\n`);
  const sse = (e: HistoryEntry): void => {
    res.write(`id: ${e.id}\nevent: history\ndata: ${JSON.stringify(e)}\n\n`);
  };
  offset = drainTail(offset, opts, sse);
  const stop = followTail(offset, opts, sse, 1_000);
  const keepalive = setInterval(() => res.write(': keepalive\n\n'), 25_000);
  const cleanup = (): void => { stop(); clearInterval(keepalive); try { res.end(); } catch { /* ignore */ } };
  req.on('close', cleanup); req.on('error', cleanup);
}
