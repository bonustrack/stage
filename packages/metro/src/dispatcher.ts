/** Daemon: Client.start() → envelope on stdout; optional codex-rc push; IPC for cross-process action calls. */

import { copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pkg from '../package.json' with { type: 'json' };
import { Client } from './client.js';
import { CodexRC } from './codex-rc.js';
import { startIpcServer, stopIpcServer } from './ipc.js';
import { appendHistory, formatDisplay, type HistoryEntry } from './history.js';
import { noteSeen, saveBotId } from './cache.js';
import { errMsg, log } from './log.js';
import { acquireLock, loadMetroEnv, STATE_DIR } from './paths.js';
import { noteUserFromLine } from './registry.js';
import { loadTunnelConfig, Tunnel } from './tunnel.js';
import { webhookPort } from './webhooks.js';
import type { Envelope } from './types.js';

loadMetroEnv();
acquireLock(join(STATE_DIR, '.tail-lock'));

const USERS_MD = join(STATE_DIR, 'USERS.md');
try { copyFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'users.md'), USERS_MD); }
catch (err) { log.warn({ err: errMsg(err), path: USERS_MD }, 'failed to install user skill'); }

process.stdout.on('error', err => {
  if ((err as NodeJS.ErrnoException).code !== 'EPIPE') log.warn({ err: errMsg(err) }, 'stdout error');
});

const codexRc = process.env.METRO_CODEX_RC ? new CodexRC(process.env.METRO_CODEX_RC, pkg.version) : null;
codexRc?.start();

const client = new Client();
const tunnelCfg = loadTunnelConfig();
const tunnel = tunnelCfg ? new Tunnel(tunnelCfg, webhookPort()) : null;

function envelopeToHistory(e: Envelope): HistoryEntry {
  const kind = mapKind(e.kind);
  return {
    id: e.id, ts: e.ts, kind, station: e.station, line: e.line, lineName: e.lineName,
    from: e.from, fromName: e.fromName, to: e.to ?? e.line,
    text: e.text, emoji: e.emoji, messageId: e.messageId, replyTo: e.replyTo, payload: e.payload,
  };
}

function mapKind(kind: string): HistoryEntry['kind'] {
  if (kind === 'message') return 'inbound';
  if (kind === 'reaction') return 'react';
  if (kind === 'webhook') return 'inbound';
  if (kind === 'edit' || kind === 'inbound' || kind === 'outbound' || kind === 'react') return kind;
  return 'inbound';
}

client.on('event', (envelope: Envelope) => {
  const entry: HistoryEntry = envelopeToHistory(envelope);
  const enriched: HistoryEntry = { display: formatDisplay(entry), ...entry };
  const json = JSON.stringify(enriched);
  process.stdout.write(json + '\n');
  codexRc?.push(json);
  noteSeen(entry.line, entry.lineName);
  for (const l of [entry.line, entry.from, entry.to]) if (l) noteUserFromLine(l);
  appendHistory(enriched);
});

client.on('error', (err: Error, station: string) => log.warn({ err: errMsg(err), station }, 'station error'));

/** IPC: forward `{station, action, args}` to Client.call so out-of-process CLIs can dispatch. */
const ipc = startIpcServer(async req => {
  if (req.op === 'call') {
    try {
      const result = await client.call(req.station, req.action, req.args);
      return { ok: true, result };
    } catch (err) { return { ok: false, error: errMsg(err) }; }
  }
  return { ok: false, error: `unknown op ${(req as { op: string }).op}` };
});

async function main(): Promise<void> {
  await client.start();
  const infos = client.stations();
  for (const info of infos) {
    if (!info.configured) continue;
    log.info({ station: info.name, actions: info.actions.length }, 'station ready');
    if (info.name === 'discord' || info.name === 'telegram') {
      try {
        const me = await client.call<{ id: string | number; username: string }>(info.name, 'getMe');
        saveBotId(info.name, String(me.id));
      } catch (err) { log.warn({ err: errMsg(err), station: info.name }, 'getMe failed'); }
    }
  }
  if (infos.some(i => i.configured && i.name === 'webhook')) tunnel?.start();
  log.info({ codexRc: !!codexRc, tunnel: !!tunnel }, 'dispatcher ready');
}

let shuttingDown = false;
async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info('dispatcher shutting down');
  codexRc?.stop();
  tunnel?.stop();
  await stopIpcServer(ipc).catch(() => {});
  await client.stop().catch(err => log.warn({ err: errMsg(err) }, 'client stop failed'));
  process.exit(0);
}
process.stdin.on('end', shutdown).on('close', shutdown);
for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, shutdown);

await main();
