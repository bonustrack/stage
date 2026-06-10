/** Dispatcher's plumbing: outbound event emission + train-envelope translation + HTTP receiver. */

import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  createServer, type IncomingMessage, type Server, type ServerResponse,
} from 'node:http';
import { Line } from '../lines.js';
import { errMsg, log } from '../log.js';
import { noteSeen } from '../paths.js';
import {
  appendHistory, classifyEvent, codexSelf, formatDisplay, mintId, noteUserFromLine, userSelf,
  type HistoryEntry,
} from '../history.js';
import { handleMonitorRequest } from '../cli/tail.js';
import { passesMode } from '../broker/history-stream.js';
import { readClaims } from '../broker/claims.js';
import type { TrainEvent } from '../trains/protocol.js';
import type { CodexRC } from '../codex-rc/client.js';
import { findEndpoint, listEndpoints, webhookPort, type Endpoint } from '../tunnel.js';
import { sessionOwner } from '../sessions.js';

type Emit = (entry: HistoryEntry) => void;

/** Build the HistoryEntry minted for an inbound webhook hit. Pure so the */
/** session-attribution rule is unit-testable. `to` is the endpoint's bound */
/** session owner when `endpoint.session` is set, else the webhook line itself */
/** (today's behavior — ADDITIVE: no binding ⇒ identical event). */
export function webhookEntry(
  endpoint: Endpoint, headers: Record<string, string>, body: unknown, method: string, url: string,
): HistoryEntry {
  const line = Line.webhook(endpoint.id);
  return {
    id: mintId(), ts: new Date().toISOString(), station: 'webhook',
    line, lineName: endpoint.label, from: line,
    to: endpoint.session ? sessionOwner(endpoint.session) : line,
    messageId: headers['x-github-delivery'] || headers['x-request-id'] || randomUUID(),
    text: `${headers['x-github-event'] ?? headers['x-intercom-topic'] ?? 'event'} ${method} ${url}`,
    payload: { headers, body },
  };
}

export function makeEmit(codexRc: CodexRC | null): Emit {
  /** Resolve the Codex participant URI once. The bridge must only receive the */
  /** Codex CLI's own feed — NOT every event (the historical "combined" bug: */
  /** `codexRc.push` was unconditional, so Codex also saw tony's events). */
  /** Null ⇒ no Codex identity resolvable ⇒ bridge receives nothing. */
  const cxSelf: Line | null = codexRc ? codexSelf() : null;
  if (codexRc && !cxSelf) {
    log.warn({}, 'codex bridge: no Codex identity resolvable — bridge will receive no events');
  }
  /** Short-TTL claims cache so we don't re-read claims.json per event in the */
  /** emit hot path (claims change rarely; 1s staleness is harmless). */
  let claimsCache: ReturnType<typeof readClaims> | null = null;
  let claimsAt = 0;
  const claims = (): ReturnType<typeof readClaims> => {
    const now = Date.now();
    if (!claimsCache || now - claimsAt > 1_000) { claimsCache = readClaims(); claimsAt = now; }
    return claimsCache;
  };
  return function emit(entry: HistoryEntry): void {
    /** Spread first, then `display`, so the computed bubble wins (old order let a stale one clobber it). */
    const enriched: HistoryEntry = {
      ...entry,
      display: entry.display ?? formatDisplay(entry),
      event: entry.event ?? classifyEvent(entry),
    };
    const json = JSON.stringify(enriched);
    process.stdout.write(json + '\n');
    /** Feed isolation: only forward to the Codex bridge what a */
    /** `metro tail --as=<codex-self> --strict` would receive — events routed to */
    /** the Codex owner (`to === cxSelf`) or claimed by it. Same predicate as CLI tail. */
    if (codexRc && cxSelf && passesMode(enriched, 'mine-only', cxSelf, claims())) {
      codexRc.push(json);
    }
    noteSeen(entry.line, entry.lineName);
    for (const l of [entry.line, entry.from, entry.to]) if (l) noteUserFromLine(l);
    appendHistory(enriched);
  };
}

/** Translate the snake_case train wire envelope to a camelCase `HistoryEntry`. */
/** Trains can omit `id`/`station`/`to`; metro fills sensible defaults. */
export function trainEventToHistoryEntry(env: TrainEvent, trainName: string): HistoryEntry | null {
  const line = env.line;
  if (typeof line !== 'string') {
    log.warn({ train: trainName }, 'train: dropped event without `line`');
    return null;
  }
  const station = env.station ?? Line.station(line) ?? trainName;
  const isPrivate = env.is_private === true;
  /** Trains may still emit `emoji` for reactions — fold it into text so the new envelope stays minimal. */
  const text = env.text ?? (env.emoji ? `[react ${env.emoji}]` : undefined);
  return {
    /** Carry the typed content-type verbatim when the train sets it (canonical path); */
    /** the emit wrapper falls back to `classifyEvent` only when absent (legacy parity). */
    event: env.event,
    id: env.id ?? mintId(),
    ts: env.ts ?? new Date().toISOString(),
    station,
    line: line as HistoryEntry['line'],
    lineName: env.line_name,
    from: (env.from ?? `metro://${station}`) as HistoryEntry['from'],
    fromName: env.from_name,
    to: (env.to ?? (isPrivate ? userSelf() : line)) as HistoryEntry['to'],
    text,
    messageId: env.message_id,
    replyTo: env.reply_to,
    payload: env.payload,
  };
}

export async function startWebhookServer(emit: Emit): Promise<Server> {
  const port = webhookPort();
  const server = createServer((req, res) => {
    handleRequest(req, res, emit).catch(err => {
      log.warn({ err: errMsg(err) }, 'webhook handler error');
      if (!res.headersSent) res.writeHead(500).end();
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      log.info({ port, endpoints: listEndpoints().length }, 'webhook + monitor ready');
      resolve();
    });
  });
  return server;
}

async function handleRequest(req: IncomingMessage, res: ServerResponse, emit: Emit): Promise<void> {
  if (handleMonitorRequest(req, res)) return;
  const m = req.url?.match(/^\/wh\/([A-Za-z0-9_-]+)/);
  if (!m) { res.writeHead(404).end(); return; }
  const endpointId = m[1];
  const endpoint = findEndpoint(endpointId);
  if (!endpoint) { res.writeHead(404).end(); return; }
  if (req.method === 'GET') { res.writeHead(200).end(`metro webhook ${endpointId} ready\n`); return; }
  if (req.method !== 'POST') { res.writeHead(405).end(); return; }

  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks);
  const headers = Object.fromEntries(
    Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : v ?? '']),
  );
  if (endpoint.secret && !verifySig(endpoint.secret, raw, headers['x-hub-signature-256'])) {
    log.warn({ endpoint: endpointId }, 'webhook signature mismatch — rejecting');
    res.writeHead(401).end('signature mismatch');
    return;
  }
  let body: unknown = raw.toString('utf8');
  try { body = JSON.parse(body as string); } catch { /* keep as string */ }

  emit(webhookEntry(endpoint, headers, body, req.method ?? 'POST', req.url ?? ''));
  res.writeHead(200).end('ok');
}

function verifySig(secret: string, raw: Buffer, header?: string): boolean {
  if (!header?.startsWith('sha256=')) return false;
  const given = Buffer.from(header.slice(7), 'hex');
  const want = createHmac('sha256', secret).update(raw).digest();
  return given.length === want.length && timingSafeEqual(given, want);
}
