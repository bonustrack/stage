/** HTTP monitor endpoints: GET /api/state, GET /api/tail (SSE), POST /api/call/<train>/<action>. */

import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import pkg from '../../package.json' with { type: 'json' };
import { readClaims } from '../broker/claims.js';
import {
  drainTail, followTail, historySize, type Mode, type TailOpts,
} from '../broker/history-stream.js';
import { isMember, readMembers } from '../broker/members.js';
import { readHistory, type HistoryEntry } from '../history.js';
import { ipcCall } from '../ipc.js';
import { asLine, Line } from '../lines.js';
import { errMsg, log } from '../log.js';
import { readBotIds } from '../paths.js';
import { handleSiweLogin, requesterFromJwt } from './auth-api.js';
import { routeChannels } from './channels-api.js';
import { routeMessenger } from './messenger-api.js';

/** Monitor endpoints answer only on dedicated hostnames so webhook tunnel can't double-serve them. */
const MONITOR_HOSTS = new Set(
  (process.env.METRO_MONITOR_HOSTS ?? 'monitor.metro.box,localhost,127.0.0.1')
    .toLowerCase().split(',').map(s => s.trim()).filter(Boolean),
);
const CALL_BODY_MAX = 256 * 1024;

/** Reflect request Origin so browsers (Netlify, custom domains, file://) can call cross-origin. */
function cors(req: IncomingMessage): Record<string, string> {
  return {
    'access-control-allow-origin': (req.headers.origin as string | undefined) ?? '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'Authorization, Content-Type',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}

function send(res: ServerResponse, req: IncomingMessage, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json', ...cors(req) });
  res.end(JSON.stringify(body));
}

function tokenEq(given: string, want: string): boolean {
  const g = Buffer.from(given), w = Buffer.from(want);
  return g.length === w.length && timingSafeEqual(g, w);
}

/** Auth resolution. Three outcomes:
 *  - admin: METRO_MONITOR_TOKEN bearer or `?token=` query — full unscoped access (sees everything).
 *  - user:  HS256 JWT bearer minted by /api/auth/siwe — membership-scoped to the wallet URI.
 *  - none:  401. */
type Auth = { kind: 'admin' } | { kind: 'user'; sub: Line } | { kind: 'none'; status: number; msg: string };
function authorize(req: IncomingMessage, q?: URLSearchParams): Auth {
  const token = process.env.METRO_MONITOR_TOKEN;
  if (!token) return { kind: 'none', status: 503, msg: 'monitor endpoints not configured (METRO_MONITOR_TOKEN unset)' };
  const header = ([] as string[]).concat(req.headers['authorization'] ?? [])[0];
  if (header?.startsWith('Bearer ') && tokenEq(header.slice(7), token)) return { kind: 'admin' };
  const qt = q?.get('token');
  if (qt && tokenEq(qt, token)) return { kind: 'admin' };
  /** JWT path — wallets that signed in via SIWE get a Bearer that resolves to their URI. */
  const sub = requesterFromJwt(req);
  if (sub) return { kind: 'user', sub };
  return { kind: 'none', status: 401, msg: 'unauthorized' };
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

export function handleMonitorRequest(
  req: IncomingMessage,
  res: ServerResponse,
  emit?: (entry: HistoryEntry) => void,
): boolean {
  const url = req.url ?? '';
  if (!url.startsWith('/api/')) return false;
  const host = (req.headers[':authority' as keyof typeof req.headers] as string | undefined) ?? req.headers.host;
  if (host && !MONITOR_HOSTS.has(host.split(':')[0].toLowerCase())) return false;
  /** CORS preflight — short-circuit before auth so browsers can OPTIONS without a token. */
  if (req.method === 'OPTIONS') { res.writeHead(204, cors(req)); res.end(); return true; }
  const [path, qs = ''] = url.split('?', 2);
  const q = new URLSearchParams(qs);
  /** POST /api/auth/siwe is the bootstrap endpoint — no auth required (it's how unauthenticated
   *  wallets mint a JWT). Everything else falls into the unified auth gate below. */
  if (req.method === 'POST' && path === '/api/auth/siwe') {
    handleSiwe(req, res).catch(err => {
      log.warn({ err: errMsg(err) }, 'monitor: siwe handler error');
      try { send(res, req, 500, { error: errMsg(err) }); } catch { /* ignore */ }
    });
    return true;
  }
  const auth = authorize(req, q);
  if (auth.kind === 'none') { send(res, req, auth.status, { error: auth.msg }); return true; }
  /** Requester is set only for user JWT calls — admin gets the unscoped view (legacy behavior). */
  const requester = auth.kind === 'user' ? auth.sub : null;
  if (req.method === 'GET' && path === '/api/state') { handleState(res, req, q, requester); return true; }
  if (req.method === 'GET' && path === '/api/tail') {
    handleTail(req, res, q, requester).catch(err => {
      log.warn({ err: errMsg(err) }, 'monitor: tail handler error');
      try { if (!res.headersSent) res.writeHead(500).end(); else res.end(); } catch { /* ignore */ }
    });
    return true;
  }
  /** POST /api/call/<train>/<action> — JSON body {args} forwarded to train via IPC forward-call. */
  const callMatch = path.match(/^\/api\/call\/([^/]+)\/([^/]+)$/);
  if (callMatch) {
    if (req.method !== 'POST') { send(res, req, 405, { error: 'method not allowed' }); return true; }
    handleCall(req, res, callMatch[1], callMatch[2]).catch(err => {
      log.warn({ err: errMsg(err) }, 'monitor: call handler error');
      try { send(res, req, 500, { error: errMsg(err) }); } catch { /* ignore */ }
    });
    return true;
  }
  /** /api/messenger/* — send, register, upload, files/:name. */
  if (path.startsWith('/api/messenger/') && routeMessenger(req, res, path, emit, send)) return true;
  /** /api/channels[/...] — channel CRUD + membership mutation. */
  if (path.startsWith('/api/channels') && routeChannels(req, res, path, send, requester)) return true;
  /** GET-only paths reject other verbs with 405. Anything else → 404. */
  if (req.method !== 'GET' && (path === '/api/state' || path === '/api/tail')) {
    send(res, req, 405, { error: 'method not allowed' });
    return true;
  }
  send(res, req, 404, { error: 'not found' });
  return true;
}

function nonNegInt(raw: string | null): number | null {
  const n = raw == null ? NaN : Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/** Wraps `handleSiweLogin` with the local `send` so the auth module stays http-framework-agnostic. */
async function handleSiwe(req: IncomingMessage, res: ServerResponse): Promise<void> {
  return handleSiweLogin(req, res, send);
}

function handleState(
  res: ServerResponse, req: IncomingMessage, q: URLSearchParams, requesterFromAuth: Line | null,
): void {
  const before = nonNegInt(q.get('before'));
  const limit = Math.min(nonNegInt(q.get('limit')) ?? 100, 500);
  /** Auth-derived requester wins over `?requester=` (kept for admin testing convenience only). */
  const requesterParam = q.get('requester');
  const requester = requesterFromAuth ?? (requesterParam ? asLine(requesterParam) : null);
  /** Membership filter applied post-read; cheap because state is bounded by `limit`. */
  const members = requester ? readMembers() : null;
  const gate = (entries: HistoryEntry[]): HistoryEntry[] =>
    requester && members ? entries.filter(e => isMember(e.line, requester, members)) : entries;
  if (before !== null) return send(res, req, 200, { recent_history: gate(readHistory({ limit, skip: before })) });
  const recent = gate(readHistory({ limit })), claims = readClaims();
  const lines = new Set<string>([...recent.map(e => e.line), ...Object.keys(claims)]);
  send(res, req, 200, {
    claims, lines: [...lines], recent_history: recent, bot_ids: readBotIds(), version: pkg.version,
  });
}

async function handleTail(
  req: IncomingMessage, res: ServerResponse, q: URLSearchParams, requesterFromAuth: Line | null,
): Promise<void> {
  const asParam = q.get('as');
  const self = asParam ? asLine(asParam) : null;
  const isOn = (k: string): boolean => q.get(k) === 'true' || q.get('mode') === k;
  const mode = pickMode(isOn('strict'), isOn('unclaimed'), isOn('all'), self, () => 'all');
  const excludeFromCsv = q.get('exclude_from');
  /** Auth-derived requester wins; `?requester=` survives as an admin-token escape hatch. */
  const requesterParam = q.get('requester');
  const requester = requesterFromAuth ?? (requesterParam ? asLine(requesterParam) : undefined);
  const opts: TailOpts = {
    mode, self, chatFilter: q.get('chat') ?? undefined,
    stationFilter: q.get('station') ?? undefined,
    includeWebhooks: q.get('include_webhooks') === 'true',
    excludeFrom: excludeFromCsv ? excludeFromCsv.split(',').map(s => s.trim()).filter(Boolean) : undefined,
    requester,
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

async function handleCall(req: IncomingMessage, res: ServerResponse, train: string, action: string): Promise<void> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
    total += buf.length;
    if (total > CALL_BODY_MAX) throw new Error(`request body exceeds ${CALL_BODY_MAX} bytes`);
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  let args: unknown = {};
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { args?: unknown };
      args = parsed && typeof parsed === 'object' && 'args' in parsed ? parsed.args : parsed;
    } catch (err) { return send(res, req, 400, { error: `bad JSON body: ${errMsg(err)}` }); }
  }
  const resp = await ipcCall({ op: 'forward-call', train, action, args });
  if (!resp.ok) return send(res, req, 502, { error: resp.error });
  if (!('response' in resp)) return send(res, req, 502, { error: 'malformed daemon response' });
  if (resp.response.error) return send(res, req, 502, { error: resp.response.error });
  send(res, req, 200, { result: resp.response.result ?? null });
}
