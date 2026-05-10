// Metro orchestrator — long-running daemon. Owns the Discord gateway,
// manages one codex thread per Discord conversation thread, and streams
// per-turn responses back to chat (with tool-call status visible).
//
// Architecture diff from the previous metro:
//   Old: agent runs metro as a tool; metro just streams inbound JSON.
//   New: metro runs the agent (codex app-server) as a subprocess and
//        routes each Discord/Telegram thread to its own codex session.
//
// PR 1 scope: Discord, with codex or Claude Code as the agent. Telegram follows.

import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import pkg from '../package.json' with { type: 'json' };
import * as discord from './channels/discord.js';
import { CodexAgent } from './agents/codex.js';
import { ClaudeAgent } from './agents/claude.js';
import type { Agent, AgentTurnCallbacks } from './agents/types.js';
import {
  discordChannelFromScopeKey,
  discordScopeKey,
  getCodexThread,
  listScopes,
  setCodexThread,
  setLastSeen,
} from './lib/scope-cache.js';
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

// Track which codex threads we're actively serving a turn in, so we
// don't send overlapping turn/start requests on the same thread.
const inFlight = new Set<string>();
// Per-thread queue of follow-up messages that arrived while a turn was
// already running. Coalesced into one combined turn on completion so the
// agent can address the whole batch in one reply.
type Queued = { channelId: string; texts: string[] };
const queued = new Map<string, Queued>();
// De-dupe the *same* gateway delivery (e.g. on reconnect replay). Keyed
// on message_id so two distinct @-mentions in the same parent channel
// each still get their own thread.
const bootstrapped = new Set<string>();

// Which agent backs the bot. `METRO_AGENT=claude` switches to Claude Code;
// anything else (default: codex) uses the codex app-server. Choice is
// process-wide for now — per-channel routing can come later if needed.
const agentKind = (process.env.METRO_AGENT ?? 'codex').toLowerCase();
const agent: Agent =
  agentKind === 'claude'
    ? new ClaudeAgent()
    : new CodexAgent(pkg.version);
log.info({ agent: agentKind }, 'orchestrator: agent selected');

// One scheduler per bot — coalesces streamed edits across every active
// thread so concurrent turns don't compound the bot's edit cadence.
const discordScheduler = new StreamScheduler();

async function main(): Promise<void> {
  await agent.start();

  if (platforms.discord) {
    await discord.startGateway();
    const me = await discord.getMe();
    log.info({ bot: me.username }, 'discord ready');
    discord.onInbound(m => void onDiscordInbound(m).catch(err => log.warn({ err: errMsg(err) }, 'discord inbound failed')));
    // Replay anything the user sent while metro was down. Runs in the
    // background so we don't block 'orchestrator ready' for what might be
    // a long REST pass.
    void catchupDiscord().catch(err => log.warn({ err: errMsg(err) }, 'discord catchup failed'));
  }

  log.info('orchestrator ready');
}

async function catchupDiscord(): Promise<void> {
  const scopes = listScopes();
  for (const { scopeKey, entry } of scopes) {
    const channelId = discordChannelFromScopeKey(scopeKey);
    if (!channelId || !entry.lastSeenMessageId) continue;
    try {
      const missed = await discord.fetchMessagesSince(channelId, entry.lastSeenMessageId);
      const humanMissed = missed.filter(m => !m.author_is_bot && m.text);
      if (humanMissed.length === 0) continue;
      log.info({ channel: channelId, count: humanMissed.length }, 'discord catchup: replaying missed messages');
      for (const m of humanMissed) {
        // Dispatch through the normal inbound path; the orchestrator's
        // queueing collapses bursts into one combined turn.
        await onDiscordInbound({
          channel_id: channelId,
          message_id: m.message_id,
          text: m.text,
          in_guild: true,
          mentions_bot: false,
        });
      }
    } catch (err) {
      log.warn({ err: errMsg(err), channel: channelId }, 'discord catchup: channel skipped');
    }
  }
}

async function onDiscordInbound(m: discord.InboundMessage): Promise<void> {
  // DMs aren't routed in PR 1 — focus on guild thread orchestration.
  if (!m.in_guild) {
    log.debug({ channel: m.channel_id }, 'discord DM ignored (not supported yet)');
    return;
  }

  // Already inside a known thread? Route directly to its agent session.
  const cachedScope = discordScopeKey(m.channel_id);
  const cachedAgentThread = getCodexThread(cachedScope);
  if (cachedAgentThread) {
    // Watermark so catchup-on-restart knows where to pick up from.
    setLastSeen(cachedScope, m.message_id);
    await handleTurn(m.channel_id, m.text, cachedAgentThread);
    return;
  }

  // Not in a known thread. An @-mention bootstraps a new one.
  if (!m.mentions_bot) {
    log.debug({ channel: m.channel_id }, 'discord guild msg dropped: no scope, no @-mention');
    return;
  }
  if (bootstrapped.has(m.message_id)) return;
  bootstrapped.add(m.message_id);
  const agentThreadId = await agent.createThread();
  // Thread name is the user's message itself — easier to scan in the
  // Discord sidebar than the raw session id. Falls back to the agent
  // thread id if the message has no usable text (image-only, etc.).
  const threadName = makeThreadName(m.text, agentThreadId);
  log.info({ parent: m.channel_id, agent: agentThreadId, threadName }, 'discord: bootstrapping new scope from @-mention');
  const threadId = await discord.createThreadFromMessage(m.channel_id, m.message_id, threadName);
  setCodexThread(discordScopeKey(threadId), agentThreadId);
  log.info({ discord: threadId, agent: agentThreadId }, 'scope created');

  await handleTurn(threadId, m.text, agentThreadId);
}

// Discord thread names: 1-100 chars, no newlines. Strip <@id>, <@&id>,
// <#id>, custom emoji syntax, then normalize whitespace. Falls back to
// the agent thread id if nothing usable is left.
function makeThreadName(rawText: string, fallback: string): string {
  const cleaned = rawText
    .replace(/<@!?\d+>/g, '')
    .replace(/<@&\d+>/g, '')
    .replace(/<#\d+>/g, '')
    .replace(/<a?:[^:]+:\d+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return fallback.slice(0, 100);
  return cleaned.length <= 100 ? cleaned : cleaned.slice(0, 99) + '…';
}

/**
 * Run one agent turn against a known agent thread, streaming the response
 * back to the given Discord channel. If a turn is already in flight for
 * this thread, append the text to the per-thread queue instead — it'll
 * be picked up as the next combined turn when the current one finishes.
 */
async function handleTurn(
  channelId: string,
  text: string,
  agentThreadId: string,
): Promise<void> {
  if (inFlight.has(agentThreadId)) {
    const q = queued.get(agentThreadId);
    if (q) q.texts.push(text);
    else queued.set(agentThreadId, { channelId, texts: [text] });
    log.debug({ agent: agentThreadId, queueDepth: queued.get(agentThreadId)!.texts.length }, 'queued follow-up turn');
    return;
  }
  inFlight.add(agentThreadId);

  const stream = new StreamingMessage(
    {
      send: t => discord.sendMessage(channelId, t),
      edit: async (id, t) => { await discord.editMessage(channelId, id, t); },
    },
    discordScheduler,
  );

  // Called from both onComplete and onError. Drains any queued follow-ups
  // into a single combined next turn so the agent answers the whole batch
  // in one reply (matches chat semantics where you read all new messages
  // before responding).
  const finishAndDrain = async (): Promise<void> => {
    await stream.finalize();
    inFlight.delete(agentThreadId);
    const q = queued.get(agentThreadId);
    if (!q || q.texts.length === 0) return;
    queued.delete(agentThreadId);
    const combined = q.texts.join('\n\n');
    log.debug({ agent: agentThreadId, batched: q.texts.length }, 'draining queued follow-ups');
    await handleTurn(q.channelId, combined, agentThreadId).catch(err =>
      log.warn({ err: errMsg(err) }, 'queued turn failed'),
    );
  };

  const callbacks: AgentTurnCallbacks = {
    onDelta: d => stream.appendDelta(d),
    onToolStart: (_kind, summary) => stream.setStatus(summary),
    onToolEnd: () => stream.setStatus(null),
    onComplete: () => { void finishAndDrain(); },
    onError: err => {
      log.warn({ err: errMsg(err) }, 'agent turn failed');
      // Surface in chat so the user isn't left staring at "Thinking…".
      stream.appendError(errMsg(err) || 'agent turn failed');
      void finishAndDrain();
    },
  };

  await agent.sendTurn(agentThreadId, text, callbacks);
}

// Graceful shutdown — let the agent tear down cleanly (codex's daemon
// syncs state to disk; claude kills any in-flight subprocesses) and the
// bot shows offline immediately.
let shuttingDown = false;
async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info('orchestrator shutting down');
  await agent.stop().catch(err => log.warn({ err: errMsg(err) }, 'agent shutdown failed'));
  if (platforms.discord) await discord.shutdownGateway().catch(err => log.warn({ err: errMsg(err) }, 'discord shutdown failed'));
  process.exit(0);
}
process.stdin.on('end', shutdown);
process.stdin.on('close', shutdown);
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await main();
