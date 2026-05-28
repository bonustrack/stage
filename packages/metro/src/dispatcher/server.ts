/** Dispatcher's plumbing: outbound event emission + train-envelope translation + HTTP receiver. */

import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  createServer, type IncomingMessage, type Server, type ServerResponse,
} from 'node:http';
import { Line } from '../lines.js';
import { errMsg, log } from '../log.js';
import { noteSeen } from '../paths.js';
import {
  appendHistory, formatDisplay, mintId, noteUserFromLine, userSelf, type HistoryEntry,
} from '../history.js';
import { handleMonitorRequest } from '../cli/tail.js';
import type { TrainEvent } from '../trains/protocol.js';
import type { CodexRC } from '../codex-rc/client.js';
import { findEndpoint, listEndpoints, webhookPort } from '../tunnel.js';

type Emit = (entry: HistoryEntry) => void;

export function makeEmit(codexRc: CodexRC | null): Emit {
  return function emit(entry: HistoryEntry): void {
    /** Spread first, then `display`, so the computed bubble wins (old order let a stale one clobber it). */
    const enriched: HistoryEntry = { ...entry, display: entry.display ?? formatDisplay(entry) };
    const json = JSON.stringify(enriched);
    process.stdout.write(json + '\n');
    codexRc?.push(json);
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

  const line = Line.webhook(endpointId);
  emit({
    id: mintId(), ts: new Date().toISOString(), station: 'webhook',
    line, lineName: endpoint.label, from: line, to: line,
    messageId: headers['x-github-delivery'] || headers['x-request-id'] || randomUUID(),
    text: `${headers['x-github-event'] ?? headers['x-intercom-topic'] ?? 'event'} ${req.method} ${req.url}`,
    payload: { headers, body },
  });
  res.writeHead(200).end('ok');
}

function verifySig(secret: string, raw: Buffer, header?: string): boolean {
  if (!header?.startsWith('sha256=')) return false;
  const given = Buffer.from(header.slice(7), 'hex');
  const want = createHmac('sha256', secret).update(raw).digest();
  return given.length === want.length && timingSafeEqual(given, want);
}
