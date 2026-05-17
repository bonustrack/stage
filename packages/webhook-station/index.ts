/** Webhook station — receive-only HTTP server; one path `/wh/<id>` per registered endpoint. */

import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import {
  findEndpoint, handleMonitorRequest, Line, listEndpoints, mintId, webhookPort,
  type Envelope, type Station,
} from '@stage-labs/metro';

let server: Server | null = null;
let emit: ((e: Envelope) => void) | null = null;

const station: Station = {
  name: 'webhook',

  configured: () => listEndpoints().length > 0,

  async start(e) {
    emit = e;
    const port = webhookPort();
    await new Promise<void>((resolve, reject) => {
      server = createServer((req, res) => handle(req, res).catch(() => {
        if (!res.headersSent) res.writeHead(500).end();
      }));
      server.on('error', reject);
      server.listen(port, '127.0.0.1', () => resolve());
    });
  },

  async stop() {
    const srv = server;
    if (!srv) return;
    await new Promise<void>(resolve => srv.close(() => resolve()));
    server = null;
    emit = null;
  },

  actions: { /* receive-only */ },
};

function pickEvent(headers: Record<string, string>): string {
  return headers['x-github-event'] ?? headers['x-intercom-topic'] ?? 'event';
}

function verifySig(secret: string, raw: Buffer, header?: string): boolean {
  if (!header?.startsWith('sha256=')) return false;
  const given = Buffer.from(header.slice(7), 'hex');
  const want = createHmac('sha256', secret).update(raw).digest();
  return given.length === want.length && timingSafeEqual(given, want);
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Buffer.concat(chunks);
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (handleMonitorRequest(req, res)) return;
  const m = req.url?.match(/^\/wh\/([A-Za-z0-9_-]+)/);
  if (!m) { res.writeHead(404).end(); return; }
  const endpointId = m[1];
  const endpoint = findEndpoint(endpointId);
  if (!endpoint) { res.writeHead(404).end(); return; }
  if (req.method === 'GET') { res.writeHead(200).end(`metro webhook ${endpointId} ready\n`); return; }
  if (req.method !== 'POST') { res.writeHead(405).end(); return; }

  const raw = await readBody(req);
  const headers = Object.fromEntries(
    Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : v ?? '']));

  if (endpoint.secret && !verifySig(endpoint.secret, raw, headers['x-hub-signature-256'])) {
    res.writeHead(401).end('signature mismatch');
    return;
  }

  let body: unknown = raw.toString('utf8');
  try { body = JSON.parse(body as string); } catch { /* keep as string */ }

  const line = Line.webhook(endpointId);
  emit?.({
    id: mintId(), ts: new Date().toISOString(), kind: 'webhook', station: 'webhook',
    line, lineName: endpoint.label, from: line,
    messageId: headers['x-github-delivery'] || headers['x-request-id'] || randomUUID(),
    text: `${pickEvent(headers)} ${req.method} ${req.url}`,
    payload: { headers, body },
  });
  res.writeHead(200).end('ok');
}

export default station;
