/** Daemon: supervises ~/.metro/trains/*, multiplexes their stdout to one JSON event stream, */
/** routes outbound `forward-call` IPC back to trains' stdin. Two builtin event sources stay */
/** in core: the HTTP webhook receiver + cross-user `notify` IPC. */

import { join } from 'node:path';
import pkg from '../package.json' with { type: 'json' };
import { Line } from './lines.js';
import { CodexRC } from './codex-rc.js';
import { startIpcServer, stopIpcServer, type IpcRequest, type IpcResponse } from './ipc.js';
import {
  userSelf, appendHistory, formatDisplay, mintId, selfLine, type HistoryEntry,
} from './history.js';
import { noteSeen } from './cache.js';
import { errMsg, log } from './log.js';
import { acquireLock, loadMetroEnv, STATE_DIR } from './paths.js';
import { setCodexSessionId } from './local-identity.js';
import { noteUserFromLine } from './registry.js';
import { listEndpoints, webhookPort, findEndpoint } from './webhooks.js';
import { loadTunnelConfig, Tunnel } from './tunnel.js';
import { handleMonitorRequest } from './monitor.js';
import { TrainSupervisor, TRAINS_DIR } from './trains.js';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

loadMetroEnv();
acquireLock(join(STATE_DIR, '.tail-lock'));

const self = userSelf();
log.info({ self, line: selfLine() }, 'user identity');
const seedSelf = (): void => { const l = selfLine(); if (l) noteUserFromLine(l); };
seedSelf();

/** Suppress EPIPE so the daemon survives the reader (Monitor) restarting. */
process.stdout.on('error', err => {
  if ((err as NodeJS.ErrnoException).code !== 'EPIPE') log.warn({ err: errMsg(err) }, 'stdout error');
});

const codexRc = process.env.METRO_CODEX_RC ? new CodexRC(process.env.METRO_CODEX_RC, pkg.version) : null;
codexRc?.onThread(id => { setCodexSessionId(id); seedSelf(); });
codexRc?.start();

const supervisor = new TrainSupervisor();

function emit(entry: HistoryEntry): void {
  /** `display` first so it survives Monitor's body truncation — the user must see it to echo it. */
  const enriched: HistoryEntry = { display: formatDisplay(entry), ...entry };
  const json = JSON.stringify(enriched);
  process.stdout.write(json + '\n');
  codexRc?.push(json);
  noteSeen(entry.line, entry.lineName);
  for (const l of [entry.line, entry.from, entry.to]) if (l) noteUserFromLine(l);
  appendHistory(enriched);
}

/** Promote a train-emitted envelope to a full `HistoryEntry`. Trains can omit `id`/`station`/`to`. */
function envelopeToEntry(env: Record<string, unknown>, trainName: string): HistoryEntry | null {
  const line = env.line as string | undefined;
  if (typeof line !== 'string') {
    log.warn({ train: trainName }, 'train: dropped event without `line`');
    return null;
  }
  const station = (env.station as string | undefined) ?? Line.station(line) ?? trainName;
  const kind = (env.kind as HistoryEntry['kind'] | undefined) ?? 'inbound';
  const id = (env.id as string | undefined) ?? mintId();
  const ts = (env.ts as string | undefined) ?? new Date().toISOString();
  const from = (env.from as string | undefined) ?? `metro://${station}` ;
  const isPrivate = env.isPrivate === true;
  const to = (env.to as string | undefined) ?? (isPrivate ? userSelf() : line);
  return {
    id, ts, kind, station,
    line: line as HistoryEntry['line'],
    lineName: env.lineName as string | undefined,
    from: from as HistoryEntry['from'],
    fromName: env.fromName as string | undefined,
    to: to as HistoryEntry['to'],
    text: env.text as string | undefined,
    emoji: env.emoji as string | undefined,
    messageId: env.messageId as string | undefined,
    replyTo: env.replyTo as string | undefined,
    payload: env.payload,
  };
}

supervisor.onTrainEvent((env, train) => {
  const entry = envelopeToEntry(env, train);
  if (entry) emit(entry);
});

/** Builtin: webhook HTTP receiver + monitor endpoints. */
let webhookServer: Server | null = null;
async function startWebhookServer(): Promise<void> {
  const port = webhookPort();
  webhookServer = createServer((req, res) => {
    handleWebhookRequest(req, res).catch(err => {
      log.warn({ err: errMsg(err) }, 'webhook handler error');
      if (!res.headersSent) res.writeHead(500).end();
    });
  });
  await new Promise<void>((resolve, reject) => {
    webhookServer!.once('error', reject);
    webhookServer!.listen(port, '127.0.0.1', () => {
      log.info({ port, endpoints: listEndpoints().length }, 'webhook + monitor ready');
      resolve();
    });
  });
}

async function handleWebhookRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
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

const tunnelCfg = loadTunnelConfig();
const tunnel = tunnelCfg ? new Tunnel(tunnelCfg, webhookPort()) : null;

const ipc = startIpcServer(async (req: IpcRequest): Promise<IpcResponse> => {
  if (req.op === 'notify') {
    const line = req.line as HistoryEntry['line'];
    emit({
      id: mintId(), ts: new Date().toISOString(), kind: 'inbound',
      station: Line.station(line) ?? '?', line,
      from: (req.from ?? userSelf()) as HistoryEntry['from'], to: line, text: req.text,
    });
    return { ok: true };
  }
  if (req.op === 'forward-call') {
    try {
      const r = await supervisor.call(req.train, req.action, req.args);
      return { ok: true, response: r };
    } catch (err) { return { ok: false, error: errMsg(err) }; }
  }
  if (req.op === 'trains-list') {
    return { ok: true, trains: supervisor.list() };
  }
  return { ok: false, error: `unknown op: ${(req as { op?: string }).op ?? '(none)'}` };
});

async function main(): Promise<void> {
  supervisor.start();
  await startWebhookServer();
  tunnel?.start();
  log.info({ codexRc: !!codexRc, tunnel: !!tunnel, trainsDir: TRAINS_DIR }, 'dispatcher ready');
}

let shuttingDown = false;
async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info('dispatcher shutting down');
  codexRc?.stop();
  tunnel?.stop();
  await stopIpcServer(ipc).catch(() => {});
  if (webhookServer) await new Promise<void>(r => webhookServer!.close(() => r()));
  await supervisor.stop();
  process.exit(0);
}
process.stdin.on('end', shutdown).on('close', shutdown);
for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, shutdown);

await main();
