/** Daemon: supervises ~/.metro/trains/*, multiplexes their stdout to one JSON event stream, */
/** routes outbound `forward-call` IPC back to trains' stdin. Two builtin event sources stay */
/** in core: the HTTP webhook receiver + cross-user `notify` IPC. */

import { join } from 'node:path';
import { type Server } from 'node:http';
import pkg from '../package.json' with { type: 'json' };
import { Line } from './lines.js';
import { CodexRC } from './codex-rc/client.js';
import { startIpcServer, stopIpcServer, type IpcRequest, type IpcResponse } from './ipc.js';
import { mintId, noteUserFromLine, selfLine, userSelf, type HistoryEntry } from './history.js';
import { errMsg, log } from './log.js';
import { acquireLock, loadMetroEnv, STATE_DIR } from './paths.js';
import { setCodexSessionId } from './local-identity.js';
import { loadTunnelConfig, Tunnel, webhookPort } from './tunnel.js';
import { TrainSupervisor, TRAINS_DIR } from './trains/supervisor.js';
import { makeEmit, startWebhookServer, trainEventToHistoryEntry } from './dispatcher/server.js';
import { OutboxDriver } from './outbox-driver.js';

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
/** Durable outbox: journals MUTATE forward-calls, retries transient failures with
 *  backoff, dead-letters terminal ones. READ calls pass straight through. */
const outbox = new OutboxDriver((train, action, args) => supervisor.call(train, action, args));
const emit = makeEmit(codexRc);

supervisor.onTrainEvent((env, train) => {
  const entry = trainEventToHistoryEntry(env, train);
  if (entry) emit(entry);
});

let webhookServer: Server | null = null;
const tunnelCfg = loadTunnelConfig();
const tunnel = tunnelCfg ? new Tunnel(tunnelCfg, webhookPort()) : null;

const ipc = startIpcServer(async (req: IpcRequest): Promise<IpcResponse> => {
  if (req.op === 'notify') {
    const line = req.line as HistoryEntry['line'];
    emit({
      id: mintId(), ts: new Date().toISOString(),
      station: Line.station(line) ?? '?', line,
      from: (req.from ?? userSelf()) as HistoryEntry['from'], to: line, text: req.text,
    });
    return { ok: true };
  }
  if (req.op === 'forward-call') {
    try {
      const r = await outbox.forward(req.train, req.action, req.args, req.idempotencyKey);
      return { ok: true, response: r };
    } catch (err) { return { ok: false, error: errMsg(err) }; }
  }
  if (req.op === 'trains-list') {
    return { ok: true, trains: supervisor.list() };
  }
  if (req.op === 'train-restart') {
    try { await supervisor.restart(req.name); return { ok: true }; }
    catch (err) { return { ok: false, error: errMsg(err) }; }
  }
  if (req.op === 'outbox-list') {
    return { ok: true, entries: outbox.list({ state: req.state, limit: req.limit }) };
  }
  if (req.op === 'outbox-retry') {
    return outbox.retry(req.outboxId)
      ? { ok: true }
      : { ok: false, error: `no outbox entry with id '${req.outboxId}'` };
  }
  return { ok: false, error: `unknown op: ${(req as { op?: string }).op ?? '(none)'}` };
});

async function main(): Promise<void> {
  supervisor.start();
  webhookServer = await startWebhookServer(emit);
  tunnel?.start();
  /** Restart recovery: re-dispatch only never-sent entries (conservative — see */
  /** outbox.ts). Trains must be up first, so this runs after supervisor.start(). */
  outbox.recover();
  log.info({ codexRc: !!codexRc, tunnel: !!tunnel, trainsDir: TRAINS_DIR }, 'dispatcher ready');
}

let shuttingDown = false;
async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info('dispatcher shutting down');
  codexRc?.stop();
  tunnel?.stop();
  outbox.stop();
  await stopIpcServer(ipc).catch(() => {});
  if (webhookServer) await new Promise<void>(r => webhookServer!.close(() => r()));
  await supervisor.stop();
  process.exit(0);
}
process.stdin.on('end', shutdown).on('close', shutdown);
for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, shutdown);

await main();
