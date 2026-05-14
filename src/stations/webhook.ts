/** Receive-only HTTP station. Each registered endpoint = one path `/wh/<id>` → InboundMessage on stdout. */

import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { errMsg, log } from '../log.js';
import { mintId } from '../history.js';
import { findEndpoint, listEndpoints, webhookPort } from '../webhooks.js';
import { Line, type InboundMessage } from './index.js';

export type WebhookPayload = { headers: Record<string, string>; body: unknown };

/** Synthesize an `event` tag from common provider-specific headers (GitHub, Intercom). */
function pickEvent(headers: Record<string, string>): string {
  return headers['x-github-event'] ?? headers['x-intercom-topic'] ?? 'event';
}

/** Constant-time signature check against `X-Hub-Signature-256: sha256=<hex>` (GitHub/Intercom style). */
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

export class WebhookStation {
  readonly name = 'webhook';
  private server: Server | null = null;
  private handler: ((m: InboundMessage<WebhookPayload>) => void) | null = null;

  onMessage(h: (m: InboundMessage<WebhookPayload>) => void): void { this.handler = h; }

  start(): Promise<void> {
    const port = webhookPort();
    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => this.handle(req, res).catch(err => {
        log.warn({ err: errMsg(err) }, 'webhook handler error');
        if (!res.headersSent) res.writeHead(500).end();
      }));
      this.server.on('error', reject);
      this.server.listen(port, '127.0.0.1', () => {
        log.info({ port, endpoints: listEndpoints().length }, 'webhook station ready');
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
    const m = req.url?.match(/^\/wh\/([A-Za-z0-9_-]+)/);
    if (!m) { res.writeHead(404).end(); return; }
    const endpointId = m[1];
    const endpoint = findEndpoint(endpointId);
    if (!endpoint) { res.writeHead(404).end(); return; }
    if (req.method === 'GET') { res.writeHead(200).end(`metro webhook ${endpointId} ready\n`); return; }
    if (req.method !== 'POST') { res.writeHead(405).end(); return; }

    const raw = await readBody(req);
    const headers = Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : v ?? '']));

    if (endpoint.secret && !verifySig(endpoint.secret, raw, headers['x-hub-signature-256'])) {
      log.warn({ endpoint: endpointId }, 'webhook signature mismatch — rejecting');
      res.writeHead(401).end('signature mismatch');
      return;
    }

    let body: unknown = raw.toString('utf8');
    try { body = JSON.parse(body as string); } catch { /* keep as string */ }

    const line = Line.webhook(endpointId);
    this.handler?.({
      id: mintId(),
      ts: new Date().toISOString(),
      station: 'webhook',
      line,
      lineName: endpoint.label,
      from: line,
      messageId: headers['x-github-delivery'] || headers['x-request-id'] || randomUUID(),
      text: `${pickEvent(headers)} ${req.method} ${req.url}`,
      payload: { headers, body },
    });
    res.writeHead(200).end('ok');
  }
}
