/** Webhook transport: HTTP server. Emits `{endpointId, label, method, url, headers, body}` per request. */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { errMsg, log } from '../log.js';
import { handleMonitorRequest } from '../monitor.js';
import { findEndpoint, listEndpoints, webhookPort } from '../webhooks.js';
import type { Transport, EmitFn } from './index.js';

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

export class WebhookTransport implements Transport {
  readonly station = 'webhook';
  private server: Server | null = null;
  private emit: EmitFn | null = null;

  start(emit: EmitFn): Promise<void> {
    this.emit = emit;
    const port = webhookPort();
    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => this.handle(req, res).catch(err => {
        log.warn({ err: errMsg(err) }, 'webhook handler error');
        if (!res.headersSent) res.writeHead(500).end();
      }));
      this.server.on('error', reject);
      this.server.listen(port, '127.0.0.1', () => {
        log.info({ port, endpoints: listEndpoints().length }, 'webhook transport ready');
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    const srv = this.server;
    if (!srv) return;
    await new Promise<void>(resolve => srv.close(() => resolve()));
    this.server = null;
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    /** Read-only monitor endpoints (`/api/state`, `/api/tail`) share this port. */
    if (handleMonitorRequest(req, res)) return;
    const m = req.url?.match(/^\/wh\/([A-Za-z0-9_-]+)/);
    if (!m) { res.writeHead(404).end(); return; }
    const endpointId = m[1];
    const endpoint = findEndpoint(endpointId);
    if (!endpoint) { res.writeHead(404).end(); return; }
    if (req.method === 'GET') { res.writeHead(200).end(`metro webhook ${endpointId} ready\n`); return; }
    if (req.method !== 'POST') { res.writeHead(405).end(); return; }

    const raw = await readBody(req);
    const headers = Object.fromEntries(Object.entries(req.headers).map(
      ([k, v]) => [k, Array.isArray(v) ? v.join(',') : v ?? '']));

    if (endpoint.secret && !verifySig(endpoint.secret, raw, headers['x-hub-signature-256'])) {
      log.warn({ endpoint: endpointId }, 'webhook signature mismatch — rejecting');
      res.writeHead(401).end('signature mismatch');
      return;
    }

    let body: unknown = raw.toString('utf8');
    try { body = JSON.parse(body as string); } catch { /* keep as string */ }

    this.emit?.({
      station: 'webhook', kind: 'http', ts: new Date().toISOString(),
      payload: { endpointId, label: endpoint.label, method: req.method, url: req.url, headers, body },
    });
    res.writeHead(200).end('ok');
  }
}
