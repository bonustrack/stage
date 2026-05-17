/** HTTP webhook receiver + monitor endpoints, mounted on a single Node http.Server. */

import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  createServer, type IncomingMessage, type Server, type ServerResponse,
} from 'node:http';
import { errMsg, log } from '../log.js';
import { Line } from '../lines.js';
import { mintId, type HistoryEntry } from '../history.js';
import { handleMonitorRequest } from '../monitor.js';
import { findEndpoint, listEndpoints, webhookPort } from '../webhooks.js';

type Emit = (entry: HistoryEntry) => void;

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
    id: mintId(), ts: new Date().toISOString(), kind: 'inbound', station: 'webhook',
    line, lineName: endpoint.label,
    from: line, to: line,
    messageId: headers['x-github-delivery'] || headers['x-request-id'] || randomUUID(),
    text: `${pickEvent(headers)} ${req.method} ${req.url}`,
    payload: { headers, body },
  });
  res.writeHead(200).end('ok');
}

const pickEvent = (headers: Record<string, string>): string =>
  headers['x-github-event'] ?? headers['x-intercom-topic'] ?? 'event';

function verifySig(secret: string, raw: Buffer, header?: string): boolean {
  if (!header?.startsWith('sha256=')) return false;
  const given = Buffer.from(header.slice(7), 'hex');
  const want = createHmac('sha256', secret).update(raw).digest();
  return given.length === want.length && timingSafeEqual(given, want);
}
