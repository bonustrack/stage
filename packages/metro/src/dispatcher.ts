/**
 * Daemon: chat inbound → JSON on stdout; optional codex-rc push; cross-user `notify` over Unix socket.
 */

import { copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pkg from '../package.json' with { type: 'json' };
import { DiscordStation } from './stations/discord.js';
import { TelegramStation } from './stations/telegram.js';
import { WebhookStation } from './stations/webhook.js';
import { asLine, Line, type InboundMessage, type InboundReaction } from './stations/index.js';
import { CodexRC } from './codex-rc.js';
import { startIpcServer, stopIpcServer } from './ipc.js';
import { userSelf, appendHistory, formatDisplay, mintId, selfLine, type HistoryEntry } from './history.js';
import { noteSeen, saveBotId } from './cache.js';
import { errMsg, log } from './log.js';
import { acquireLock, configuredPlatforms, loadMetroEnv, STATE_DIR, requireConfiguredPlatform } from './paths.js';
import { setCodexSessionId } from './stations/codex.js';
import { noteUserFromLine } from './registry.js';
import { listEndpoints, webhookPort } from './webhooks.js';
import { loadTunnelConfig, Tunnel } from './tunnel.js';

loadMetroEnv();
const platforms = configuredPlatforms();
const endpoints = listEndpoints();
requireConfiguredPlatform(platforms, endpoints.length > 0);
acquireLock(join(STATE_DIR, '.tail-lock'));

// Fail fast if launched from Claude Code without a logged-in account.
const self = userSelf();
log.info({ self, line: selfLine() }, 'user identity');
const seedSelf = (): void => { const l = selfLine(); if (l) noteUserFromLine(l); };
seedSelf();

const USERS_MD = join(STATE_DIR, 'USERS.md');
try { copyFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'users.md'), USERS_MD); }
catch (err) { log.warn({ err: errMsg(err), path: USERS_MD }, 'failed to install user skill'); }

/** Suppress EPIPE so the daemon survives the user (Monitor reader) restarting / dying. */
process.stdout.on('error', err => {
  if ((err as NodeJS.ErrnoException).code !== 'EPIPE') log.warn({ err: errMsg(err) }, 'stdout error');
});

const codexRc = process.env.METRO_CODEX_RC ? new CodexRC(process.env.METRO_CODEX_RC, pkg.version) : null;
codexRc?.onThread(id => { setCodexSessionId(id); seedSelf(); });
codexRc?.start();

const discord = new DiscordStation();
const telegram = new TelegramStation();
const webhook = new WebhookStation();
const tunnelCfg = loadTunnelConfig();
const tunnel = tunnelCfg ? new Tunnel(tunnelCfg, webhookPort()) : null;

function emit(entry: HistoryEntry): void {
  /** `display` first so it survives Monitor's ~500-char body truncation — the user must see it to echo it. */
  const enriched: HistoryEntry = { display: formatDisplay(entry), ...entry };
  const json = JSON.stringify(enriched);
  process.stdout.write(json + '\n');
  codexRc?.push(json);
  noteSeen(entry.line, entry.lineName);
  for (const l of [entry.line, entry.from, entry.to]) if (l) noteUserFromLine(l);
  appendHistory(enriched);
}

const destinationFor = (m: { line: Line; isPrivate?: boolean }): Line =>
  m.isPrivate ? userSelf() : m.line;
const onInbound = (m: InboundMessage): void => emit({ ...m, kind: 'inbound', to: destinationFor(m) });
const onReaction = (r: InboundReaction): void => emit({ ...r, kind: 'react', to: destinationFor(r) });

const ipc = startIpcServer(async req => {
  if (req.op === 'notify') {
    const line = asLine(req.line);
    emit({
      id: mintId(), ts: new Date().toISOString(), kind: 'inbound',
      station: Line.station(line) ?? '?', line,
      from: req.from ? asLine(req.from) : userSelf(), to: line, text: req.text,
    });
    return { ok: true };
  }
  if (req.op === 'download') {
    const line = asLine(req.line);
    const station = req.line.startsWith('metro://telegram/') ? telegram : discord;
    const files = await station.download(line, req.messageId, req.outDir);
    return { ok: true, files };
  }
  return { ok: false, error: 'unknown op' };
});

async function main(): Promise<void> {
  if (platforms.discord) {
    discord.onMessage(onInbound);
    discord.onReaction(onReaction);
    const [, me] = await Promise.all([discord.start(), discord.getMe()]);
    saveBotId('discord', me.id);
    log.info({ bot: me.username }, 'discord ready');
  }
  if (platforms.telegram) {
    telegram.onMessage(onInbound);
    telegram.onReaction(onReaction);
    const [me] = await Promise.all([telegram.getMe(), telegram.start()]);
    saveBotId('telegram', String(me.id));
    log.info({ bot: `@${me.username}` }, 'telegram ready');
  }
  /** Start the HTTP receiver only when ≥1 endpoint is registered — no point binding a port nobody listens to. */
  if (endpoints.length) {
    webhook.onMessage(onInbound);
    await webhook.start();
    tunnel?.start();
  }
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
  await webhook.stop().catch(() => {});
  if (platforms.discord) await discord.stop().catch(() => {});
  if (platforms.telegram) await telegram.stop().catch(() => {});
  process.exit(0);
}
process.stdin.on('end', shutdown).on('close', shutdown);
for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, shutdown);

await main();
