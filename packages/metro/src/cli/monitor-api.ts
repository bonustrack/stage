/** HTTP monitor endpoints: GET /api/state, GET /api/tail (SSE), POST /api/call/<train>/<action>. */

import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import pkg from '../../package.json' with { type: 'json' };
import { readClaims } from '../broker/claims.js';
import {
  drainTail, followTail, historySize, type Mode, type TailOpts,
} from '../broker/history-stream.js';
import { readHistory, type HistoryEntry } from '../history.js';
import { ipcCall } from '../ipc.js';
import { asLine, Line } from '../lines.js';
import { errMsg, log } from '../log.js';
import { readBotIds } from '../paths.js';

/** Monitor endpoints answer only on dedicated hostnames so webhook tunnel can't double-serve them. */
const MONITOR_HOSTS = new Set(
  (process.env.METRO_MONITOR_HOSTS ?? 'monitor.metro.box,localhost,127.0.0.1')
    .toLowerCase().split(',').map(s => s.trim()).filter(Boolean),
);
const JSON_CT = { 'content-type': 'application/json' };

/** Reflect the request Origin so browsers (Netlify, custom domains, file://) can call cross-origin. */
function cors(req: IncomingMessage): Record<string, string> {
  const origin = (req.headers.origin as string | undefined) ?? '*';
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'Authorization, Content-Type',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}

function jsonRes(res: ServerResponse, status: number, body: unknown, req?: IncomingMessage): void {
  res.writeHead(status, { ...JSON_CT, ...(req ? cors(req) : {}) });
  res.end(JSON.stringify(body));
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
  /** CORS preflight — short-circuit before auth so browsers can OPTIONS without a token. */
  if (req.method === 'OPTIONS') { res.writeHead(204, cors(req)); res.end(); return true; }
  const auth = authorized(req);
  if (auth) { jsonRes(res, auth.status, { error: auth.msg }, req); return true; }
  const [path, qs = ''] = url.split('?', 2);
  const q = new URLSearchParams(qs);
  if (req.method === 'GET' && path === '/api/state') { handleState(res, q, req); return true; }
  if (req.method === 'GET' && path === '/api/tail') {
    handleTail(req, res, q).catch(err => {
      log.warn({ err: errMsg(err) }, 'monitor: tail handler error');
      try { if (!res.headersSent) res.writeHead(500).end(); else res.end(); } catch { /* ignore */ }
    });
    return true;
  }
  /** POST /api/call/<train>/<action> — JSON body {args} forwarded to train via IPC forward-call. */
  const callMatch = path.match(/^\/api\/call\/([^/]+)\/([^/]+)$/);
  if (callMatch) {
    if (req.method !== 'POST') { jsonRes(res, 405, { error: 'method not allowed' }, req); return true; }
    handleCall(req, res, callMatch[1], callMatch[2]).catch(err => {
      log.warn({ err: errMsg(err) }, 'monitor: call handler error');
      try { jsonRes(res, 500, { error: errMsg(err) }, req); } catch { /* ignore */ }
    });
    return true;
  }
  /** GET-only paths reject other verbs with 405. Anything else → 404. */
  if (req.method !== 'GET' && (path === '/api/state' || path === '/api/tail')) {
    jsonRes(res, 405, { error: 'method not allowed' }, req);
    return true;
  }
  jsonRes(res, 404, { error: 'not found' }, req);
  return true;
}

function nonNegInt(raw: string | null): number | null {
  const n = raw == null ? NaN : Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

function handleState(res: ServerResponse, q: URLSearchParams, req: IncomingMessage): void {
  const before = nonNegInt(q.get('before'));
  const limit = Math.min(nonNegInt(q.get('limit')) ?? 100, 500);
  if (before !== null) return jsonRes(res, 200, { recent_history: readHistory({ limit, skip: before }) }, req);
  const recent = readHistory({ limit }), claims = readClaims();
  const lines = new Set<string>([...recent.map(e => e.line), ...Object.keys(claims)]);
  jsonRes(res, 200, {
    claims, lines: [...lines], recent_history: recent, bot_ids: readBotIds(), version: pkg.version,
  }, req);
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
    'connection': 'keep-alive', ...cors(req),
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

const CALL_BODY_MAX = 256 * 1024;

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
    total += buf.length;
    if (total > CALL_BODY_MAX) throw new Error(`request body exceeds ${CALL_BODY_MAX} bytes`);
    chunks.push(buf);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function handleCall(req: IncomingMessage, res: ServerResponse, train: string, action: string): Promise<void> {
  let args: unknown = {};
  const raw = (await readBody(req)).trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { args?: unknown };
      args = parsed && typeof parsed === 'object' && 'args' in parsed ? parsed.args : parsed;
    } catch (err) { return jsonRes(res, 400, { error: `bad JSON body: ${errMsg(err)}` }, req); }
  }
  const resp = await ipcCall({ op: 'forward-call', train, action, args });
  if (!resp.ok) return jsonRes(res, 502, { error: resp.error }, req);
  if (!('response' in resp)) return jsonRes(res, 502, { error: 'malformed daemon response' }, req);
  if (resp.response.error) return jsonRes(res, 502, { error: resp.response.error }, req);
  jsonRes(res, 200, { result: resp.response.result ?? null }, req);
}
