/** CLI tail/claim/release/claims + read-only /api/state + /api/tail HTTP. Share drain/watch primitives. */

import { timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import pkg from '../../package.json' with { type: 'json' };
import { CLAIMS_FILE, claimLine, readClaims, releaseLine } from '../broker/claims.js';
import {
  cursorKey, drainTail, followTail, historySize, readCursor, writeCursor,
  type Mode, type TailOpts,
} from '../broker/history-stream.js';
import { readBotIds } from '../cache.js';
import { readHistory, userSelf, type HistoryEntry } from '../history.js';
import { asLine, Line } from '../lines.js';
import { errMsg, log } from '../log.js';
import { loadMetroEnv } from '../paths.js';
import { emit, exitErr, flagOne, isJson, need, writeJson, type Flags } from './util.js';

/* ──────────── CLI: metro tail / claim / release / claims ──────────── */

/** Pick mode from 3 booleans + optional self. Conflict/strict-no-self routed through `onErr`. */
function pickMode(
  strict: boolean, unclaimed: boolean, all: boolean, self: Line | null,
  onErr: (msg: string) => never | Mode,
): Mode {
  if ([strict, unclaimed, all].filter(Boolean).length > 1) return onErr('strict/unclaimed/all are mutually exclusive');
  if (strict) return self ? 'mine-only' : onErr('strict requires --as <user-uri>');
  if (unclaimed) return 'unclaimed';
  if (all || !self) return 'all';
  return 'mine-or-unclaimed';
}

export async function cmdTail(_: string[], f: Flags): Promise<void> {
  loadMetroEnv();
  const raw = flagOne(f, 'as');
  const auto = userSelf();
  const self: Line | null = raw !== undefined ? asLine(raw) : auto === 'metro://user' ? null : auto;
  const mode = pickMode(f.strict === true, f.unclaimed === true, f.all === true, self,
    msg => { throw exitErr(`--${msg}`, 1); });
  const tail: TailOpts = {
    mode, self, chatFilter: flagOne(f, 'chat'), stationFilter: flagOne(f, 'station'),
    includeWebhooks: f['include-webhooks'] === true,
  };
  const follow = f.follow === true;
  const limit = Number(flagOne(f, 'limit')) || 0;
  const json = isJson(f);
  /** Cursor key derives from effective mode (not userSelf), so --all/--unclaimed don't trample --as. */
  const key = cursorKey(mode, self, { includeWebhooks: tail.includeWebhooks });
  const since = flagOne(f, 'since');
  const sN = since !== undefined && since !== 'tail' ? Number(since) : NaN;
  if (since !== undefined && since !== 'tail' && (!Number.isFinite(sN) || sN < 0)) {
    throw exitErr(`--since must be a byte offset or 'tail' (got '${since}')`, 1);
  }
  let offset = since === 'tail' ? historySize() : Number.isFinite(sN) ? sN : key ? readCursor(key) : 0;
  let emitted = 0;
  const onEntry = (entry: HistoryEntry): boolean | void => {
    process.stdout.write((json ? JSON.stringify(entry) : fmtRow(entry)) + '\n');
    if (key) writeCursor(key, offset);
    if (limit && ++emitted >= limit) return true;
  };
  offset = drainTail(offset, tail, onEntry);
  if ((limit && emitted >= limit) || !follow) return;
  await new Promise<void>(resolve => {
    const stop = followTail(offset, tail, e => { if (onEntry(e) === true) finish(); }, 500);
    const finish = (): void => { stop(); resolve(); };
    process.on('SIGINT', finish); process.on('SIGTERM', finish);
    process.stdin.on('end', finish).on('close', finish);
  });
}

function fmtRow(e: HistoryEntry): string {
  const body = e.text ?? (e.emoji ? `[react ${e.emoji}]` : '');
  const text = body.length > 80 ? body.slice(0, 79) + '…' : body;
  const who = (e.fromName ?? e.from).padEnd(28).slice(0, 28);
  const where = e.line.padEnd(40).slice(0, 40);
  return `${e.ts.slice(11, 19)}  ${e.id.padEnd(12)}  ${e.kind.padEnd(8)}  ${who}  ${where}  ${text}`;
}

export async function cmdClaim(p: string[], f: Flags): Promise<void> {
  loadMetroEnv();
  need(p, 1, 'metro claim <line> [--as <user-uri>]');
  const line = asLine(p[0]);
  const asRaw = flagOne(f, 'as');
  const owner = asRaw ? asLine(asRaw) : userSelf();
  const claims = claimLine(line, owner);
  emit(f, `claimed ${line} → ${owner}`, { ok: true, line, owner, claims });
}

export async function cmdRelease(p: string[], f: Flags): Promise<void> {
  loadMetroEnv();
  need(p, 1, 'metro release <line>');
  const line = asLine(p[0]);
  const { released, claims } = releaseLine(line);
  emit(f, released ? `released ${line}` : `${line} was not claimed`,
    { ok: true, released, line, claims });
}

export async function cmdClaims(_: string[], f: Flags): Promise<void> {
  loadMetroEnv();
  const claims = readClaims();
  const entries = Object.entries(claims) as [string, Line][];
  if (isJson(f)) return writeJson({ claims });
  if (!entries.length) {
    process.stdout.write(`(no claims — every tail with matching filters receives every event)\nfile: ${CLAIMS_FILE}${existsSync(CLAIMS_FILE) ? '' : ' (not created yet)'}\n`);
    return;
  }
  const w = Math.max(...entries.map(([l]) => l.length));
  process.stdout.write('metro claims\n\n');
  for (const [l, o] of entries) process.stdout.write(`  ${l.padEnd(w)}  →  ${o}\n`);
  process.stdout.write(`\n${entries.length} claim${entries.length === 1 ? '' : 's'} · ${CLAIMS_FILE}\n`);
}

/* ──────────── HTTP: /api/state + /api/tail (mounted on webhook server) ──────────── */

const MONITOR_HOSTS = new Set(['monitor.metro.box', 'localhost', '127.0.0.1']);
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

export function handleMonitorRequest(req: IncomingMessage, res: ServerResponse): boolean {
  const url = req.url ?? '';
  if (!url.startsWith('/api/')) return false;
  const host = (req.headers[':authority' as keyof typeof req.headers] as string | undefined) ?? req.headers.host;
  if (host && !MONITOR_HOSTS.has(host.split(':')[0].toLowerCase())) return false;
  if (req.method !== 'GET') { jsonRes(res, 405, { error: 'method not allowed' }); return true; }
  const auth = authorized(req);
  if (auth) { jsonRes(res, auth.status, { error: auth.msg }); return true; }
  const [path, qs = ''] = url.split('?', 2);
  const q = new URLSearchParams(qs);
  if (path === '/api/state') { handleState(res, q); return true; }
  if (path === '/api/tail') {
    handleTail(req, res, q).catch(err => {
      log.warn({ err: errMsg(err) }, 'monitor: tail handler error');
      try { if (!res.headersSent) res.writeHead(500).end(); else res.end(); } catch { /* ignore */ }
    });
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
