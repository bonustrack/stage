// Metro orchestrator — long-running daemon. Owns the Discord gateway,
// manages one codex thread per Discord conversation thread, and streams
// per-turn responses back to chat (with tool-call status visible).
//
// Architecture diff from the previous metro:
//   Old: agent runs metro as a tool; metro just streams inbound JSON.
//   New: metro runs the agent (codex app-server) as a subprocess and
//        routes each Discord/Telegram thread to its own codex session.
//
// PR 1 scope: Discord + codex. Telegram and Claude Code follow.

import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import pkg from '../package.json' with { type: 'json' };
import * as discord from './channels/discord.js';
import { CodexAgent, type AgentTurnCallbacks } from './agents/codex.js';
import { discordScopeKey, getCodexThread, setCodexThread } from './lib/scope-cache.js';
import { StreamingMessage, StreamScheduler } from './lib/streaming.js';
import { errMsg, log } from './log.js';
import { configuredPlatforms, loadMetroEnv, STATE_DIR, requireConfiguredPlatform } from './paths.js';

loadMetroEnv();
const platforms = configuredPlatforms();
requireConfiguredPlatform(platforms);

// Singleton lockfile. The orchestrator owns the Discord gateway / Telegram
// poller, so only one instance can run per machine. Same shape as the
// previous tail.ts lockfile so we don't break $STATE_DIR/.tail-lock — keep
// the name for continuity.
const LOCK_FILE = join(STATE_DIR, '.tail-lock');

function processIsAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

if (existsSync(LOCK_FILE)) {
  const pid = Number(readFileSync(LOCK_FILE, 'utf8').trim());
  if (Number.isInteger(pid) && pid > 0 && processIsAlive(pid)) {
    log.info({ pid }, 'another `metro` instance is already running; exiting');
    process.exit(0);
  }
  try { unlinkSync(LOCK_FILE); } catch { /* ignore */ }
}
mkdirSync(STATE_DIR, { recursive: true });
writeFileSync(LOCK_FILE, String(process.pid));
process.on('exit', () => { try { if (readFileSync(LOCK_FILE, 'utf8').trim() === String(process.pid)) unlinkSync(LOCK_FILE); } catch { /* ignore */ } });

// Track which Discord threads we're actively serving a turn in, so we
// don't fire-and-forget overlapping requests on the same thread.
const inFlight = new Set<string>();
// De-dupe the *same* gateway delivery (e.g. on reconnect replay). Keyed
// on message_id so two distinct @-mentions in the same parent channel
// each still get their own thread.
const bootstrapped = new Set<string>();

const codex = new CodexAgent(pkg.version);

// One scheduler per bot — coalesces streamed edits across every active
// thread so concurrent turns don't compound the bot's edit cadence.
const discordScheduler = new StreamScheduler();

async function main(): Promise<void> {
  await codex.start();

  if (platforms.discord) {
    await discord.startGateway();
    const me = await discord.getMe();
    log.info({ bot: me.username }, 'discord ready');
    discord.onInbound(m => void onDiscordInbound(m).catch(err => log.warn({ err: errMsg(err) }, 'discord inbound failed')));
  }

  log.info('orchestrator ready');
}

async function onDiscordInbound(m: discord.InboundMessage): Promise<void> {
  // DMs aren't routed in PR 1 — focus on guild thread orchestration.
  if (!m.in_guild) {
    log.debug({ channel: m.channel_id }, 'discord DM ignored (not supported yet)');
    return;
  }

  // Already inside a known thread? Route directly to its codex session.
  const cachedScope = discordScopeKey(m.channel_id);
  const cachedCodex = getCodexThread(cachedScope);
  if (cachedCodex) {
    await handleTurn(m.channel_id, m.text, cachedCodex);
    return;
  }

  // Not in a known thread. An @-mention bootstraps a new one.
  if (!m.mentions_bot) {
    log.debug({ channel: m.channel_id }, 'discord guild msg dropped: no scope, no @-mention');
    return;
  }
  if (bootstrapped.has(m.message_id)) return;
  bootstrapped.add(m.message_id);
  // Create the codex thread first so its id can name the Discord thread.
  // Lets you cross-reference scopes.json / logs from the Discord UI at a
  // glance instead of decoding our own naming convention.
  const codexThreadId = await codex.createThread();
  const threadName = codexThreadId.length <= 100 ? codexThreadId : codexThreadId.slice(0, 100);
  log.info({ parent: m.channel_id, codex: codexThreadId }, 'discord: bootstrapping new scope from @-mention');
  const threadId = await discord.createThreadFromMessage(m.channel_id, m.message_id, threadName);
  setCodexThread(discordScopeKey(threadId), codexThreadId);
  log.info({ discord: threadId, codex: codexThreadId }, 'scope created');

  await handleTurn(threadId, m.text, codexThreadId);
}

/**
 * Run one agent turn against a known codex thread, streaming the response
 * back to the given Discord channel.
 */
async function handleTurn(
  channelId: string,
  text: string,
  codexThreadId: string,
): Promise<void> {
  if (inFlight.has(codexThreadId)) {
    log.warn({ codex: codexThreadId }, 'turn already in flight for this thread; ignoring (no queueing yet)');
    return;
  }
  inFlight.add(codexThreadId);

  const stream = new StreamingMessage(
    {
      send: t => discord.sendMessage(channelId, t),
      edit: async (id, t) => { await discord.editMessage(channelId, id, t); },
    },
    discordScheduler,
  );

  const callbacks: AgentTurnCallbacks = {
    onDelta: d => stream.appendDelta(d),
    onToolStart: (_kind, summary) => stream.setStatus(summary),
    onToolEnd: () => stream.setStatus(null),
    onComplete: () => {
      void (async () => {
        await stream.finalize();
        inFlight.delete(codexThreadId);
      })();
    },
    onError: err => {
      log.warn({ err: errMsg(err) }, 'agent turn failed');
      void (async () => {
        await stream.finalize();
        inFlight.delete(codexThreadId);
      })();
    },
  };

  await codex.sendTurn(codexThreadId, text, callbacks);
}

// Graceful shutdown — let codex tear down its daemon cleanly so its file
// state syncs to disk and the bot shows offline immediately.
let shuttingDown = false;
async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info('orchestrator shutting down');
  await codex.stop().catch(err => log.warn({ err: errMsg(err) }, 'codex shutdown failed'));
  if (platforms.discord) await discord.shutdownGateway().catch(err => log.warn({ err: errMsg(err) }, 'discord shutdown failed'));
  process.exit(0);
}
process.stdin.on('end', shutdown);
process.stdin.on('close', shutdown);
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await main();
