/**
 * Daemon: chat inbound → JSON on stdout; optional codex-rc push; cross-agent `notify` over Unix socket.
 */

import { copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pkg from '../package.json' with { type: 'json' };
import { DiscordStation } from './stations/discord.js';
import { TelegramStation } from './stations/telegram.js';
import { asLine, Line, type InboundMessage } from './stations/index.js';
import { CodexRC } from './codex-rc.js';
import { startIpcServer, stopIpcServer } from './ipc.js';
import { agentSelf, appendHistory, mintId, selfLine, type HistoryEntry } from './history.js';
import { noteSeen, saveBotId } from './cache.js';
import { errMsg, log } from './log.js';
import { acquireLock, configuredPlatforms, loadMetroEnv, STATE_DIR, requireConfiguredPlatform } from './paths.js';
import { setCodexSessionId } from './stations/codex.js';
import { noteAgentFromLine } from './registry.js';

loadMetroEnv();
const platforms = configuredPlatforms();
requireConfiguredPlatform(platforms);
acquireLock(join(STATE_DIR, '.tail-lock'));

// Fail fast if launched from Claude Code without a logged-in account.
const self = agentSelf();
log.info({ self, line: selfLine() }, 'agent identity');
const seedSelf = (): void => { const l = selfLine(); if (l) noteAgentFromLine(l); };
seedSelf();

const AGENTS_MD = join(STATE_DIR, 'AGENTS.md');
try { copyFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'agents.md'), AGENTS_MD); }
catch (err) { log.warn({ err: errMsg(err), path: AGENTS_MD }, 'failed to install agent skill'); }

/** Suppress EPIPE so the daemon survives the agent (Monitor reader) restarting / dying. */
process.stdout.on('error', err => {
  if ((err as NodeJS.ErrnoException).code !== 'EPIPE') log.warn({ err: errMsg(err) }, 'stdout error');
});

const codexRc = process.env.METRO_CODEX_RC ? new CodexRC(process.env.METRO_CODEX_RC, pkg.version) : null;
codexRc?.onThread(id => { setCodexSessionId(id); seedSelf(); });
codexRc?.start();

const discord = new DiscordStation();
const telegram = new TelegramStation();

function emit(entry: HistoryEntry): void {
  const json = JSON.stringify(entry);
  process.stdout.write(json + '\n');
  codexRc?.push(json);
  noteSeen(entry.line, entry.lineName);
  for (const l of [entry.line, entry.from, entry.to]) if (l) noteAgentFromLine(l);
  appendHistory(entry);
}

const onInbound = (m: InboundMessage): void => emit({ ...m, kind: 'inbound', to: agentSelf() });

const ipc = startIpcServer(async req => {
  if (req.op === 'notify') {
    const line = asLine(req.line);
    emit({
      id: mintId(), ts: new Date().toISOString(), kind: 'notification',
      station: Line.station(line) ?? '?', line,
      from: req.from ? asLine(req.from) : agentSelf(), to: line, text: req.text,
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
    const [, me] = await Promise.all([discord.start(), discord.getMe()]);
    saveBotId('discord', me.id);
    log.info({ bot: me.username }, 'discord ready');
  }
  if (platforms.telegram) {
    telegram.onMessage(onInbound);
    const [me] = await Promise.all([telegram.getMe(), telegram.start()]);
    saveBotId('telegram', String(me.id));
    log.info({ bot: `@${me.username}` }, 'telegram ready');
  }
  log.info({ codexRc: !!codexRc }, 'dispatcher ready');
}

let shuttingDown = false;
async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info('dispatcher shutting down');
  codexRc?.stop();
  await stopIpcServer(ipc).catch(() => {});
  if (platforms.discord) await discord.stop().catch(() => {});
  if (platforms.telegram) await telegram.stop().catch(() => {});
  process.exit(0);
}
process.stdin.on('end', shutdown).on('close', shutdown);
for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, shutdown);

await main();
