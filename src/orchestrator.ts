// Metro orchestrator — long-running daemon. Owns the Discord gateway,
// spawns both codex and claude as on-demand backends, and streams per-turn
// responses back to chat with tool-call status visible.
//
// Per-message agent routing: a message ending in "with claude" / "with
// codex" (any casing) targets that agent. Otherwise, the scope's last-used
// agent answers; for brand-new scopes, the default is Claude.

import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import pkg from '../package.json' with { type: 'json' };
import * as discord from './channels/discord.js';
import * as telegram from './channels/telegram.js';
import { CodexAgent } from './agents/codex.js';
import { ClaudeAgent } from './agents/claude.js';
import type { Agent, AgentTurnCallbacks } from './agents/types.js';
import {
  type AgentKind,
  discordChannelFromScopeKey,
  discordScopeKey,
  getAgentThread,
  getLastAgent,
  listScopes,
  setAgentThread,
  setLastAgent,
  setLastSeen,
  telegramScopeKey,
} from './lib/scope-cache.js';
import { StreamingMessage, StreamScheduler, type StreamAdapter } from './lib/streaming.js';
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

// Track which agent threads we're actively serving a turn in, so we don't
// send overlapping turn/start requests on the same thread.
const inFlight = new Set<string>();
// Per-thread queue of follow-up messages that arrived while a turn was
// already running. Each entry remembers how to dispatch the next turn so
// the drain reuses the right platform adapter.
type Queued = { texts: string[]; dispatch: (text: string) => Promise<void> };
const queued = new Map<string, Queued>();
// De-dupe the *same* gateway delivery (e.g. on reconnect replay).
const bootstrapped = new Set<string>();

// Both agents are instantiated; either can fail start() and be left
// unavailable. Routing falls back gracefully when an agent isn't usable.
const codexAgent = new CodexAgent(pkg.version);
const claudeAgent = new ClaudeAgent();
const available: Partial<Record<AgentKind, Agent>> = {};

// One scheduler per bot — coalesces streamed edits across every active
// thread so concurrent turns don't compound the bot's edit cadence.
const discordScheduler = new StreamScheduler();
const telegramScheduler = new StreamScheduler();

async function startAgents(): Promise<void> {
  await Promise.allSettled([
    codexAgent.start().then(() => { available.codex = codexAgent; })
      .catch(err => log.warn({ err: errMsg(err) }, "codex unavailable — 'with codex' will fail")),
    claudeAgent.start().then(() => { available.claude = claudeAgent; })
      .catch(err => log.warn({ err: errMsg(err) }, "claude unavailable — 'with claude' will fail")),
  ]);
  if (Object.keys(available).length === 0) {
    log.fatal('no agents available — install codex or claude and authenticate');
    process.exit(2);
  }
  log.info({ agents: Object.keys(available) }, 'orchestrator: agents ready');
}

async function main(): Promise<void> {
  await startAgents();

  if (platforms.discord) {
    await discord.startGateway();
    const me = await discord.getMe();
    log.info({ bot: me.username }, 'discord ready');
    discord.onInbound(m => void onDiscordInbound(m).catch(err => log.warn({ err: errMsg(err) }, 'discord inbound failed')));
    void catchupDiscord().catch(err => log.warn({ err: errMsg(err) }, 'discord catchup failed'));
  }

  if (platforms.telegram) {
    // Identity needed for @-mention detection in groups; populated as a
    // side-effect on the channel module.
    const me = await telegram.getMe();
    log.info({ bot: `@${me.username}` }, 'telegram ready');
    telegram.onInbound(m => void onTelegramInbound(m).catch(err => log.warn({ err: errMsg(err) }, 'telegram inbound failed')));
    await telegram.startPolling();
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

// "with claude" / "with codex" suffix (any casing). Captures the kind and
// returns the message without the suffix. If no suffix, returns null.
const SUFFIX_RE = /(?:^|\s)with\s+(claude|codex)\s*$/i;
function parseAgentSuffix(text: string): { kind: AgentKind | null; cleanText: string } {
  const trimmed = text.trimEnd();
  const m = SUFFIX_RE.exec(trimmed);
  if (!m) return { kind: null, cleanText: text };
  const kind = m[1].toLowerCase() as AgentKind;
  return { kind, cleanText: trimmed.slice(0, m.index).trimEnd() };
}

// Effective agent for this turn: explicit suffix beats lastAgent beats the
// default (Claude). If the requested kind is unavailable, returns null so
// the caller can surface an error to the user.
function pickAgent(scopeKey: string | null, requestedKind: AgentKind | null): { kind: AgentKind; explicit: boolean } | { error: string } {
  if (requestedKind) {
    if (!available[requestedKind]) return { error: `${requestedKind} is not available on this metro instance` };
    return { kind: requestedKind, explicit: true };
  }
  const last = scopeKey ? getLastAgent(scopeKey) : undefined;
  if (last && available[last]) return { kind: last, explicit: false };
  if (available.claude) return { kind: 'claude', explicit: false };
  if (available.codex) return { kind: 'codex', explicit: false };
  return { error: 'no agents available' };
}

async function onDiscordInbound(m: discord.InboundMessage): Promise<void> {
  if (!m.in_guild) {
    log.debug({ channel: m.channel_id }, 'discord DM ignored (not supported yet)');
    return;
  }

  const cachedScope = discordScopeKey(m.channel_id);
  const cachedHasAnyAgent = !!(getAgentThread(cachedScope, 'codex') ?? getAgentThread(cachedScope, 'claude'));

  // Existing scope (in-thread message): route to the requested or last-used agent.
  if (cachedHasAnyAgent) {
    const parsed = parseAgentSuffix(m.text);
    const choice = pickAgent(cachedScope, parsed.kind);
    if ('error' in choice) {
      await postErrorMessage(m.channel_id, choice.error);
      return;
    }
    setLastSeen(cachedScope, m.message_id);
    let agentThreadId = getAgentThread(cachedScope, choice.kind);
    if (!agentThreadId) {
      // First time using this agent in this scope — fresh session, no prior
      // history shared with the other agent.
      agentThreadId = await available[choice.kind]!.createThread();
      setAgentThread(cachedScope, choice.kind, agentThreadId);
      log.info({ scope: cachedScope, agent: choice.kind, thread: agentThreadId }, 'allocated new agent session for existing scope');
    } else {
      setLastAgent(cachedScope, choice.kind);
    }
    await handleTurn(parsed.cleanText, choice.kind, agentThreadId, discordAdapter(m.channel_id), discordScheduler);
    return;
  }

  // No scope yet — only @-mentions bootstrap a new thread.
  if (!m.mentions_bot) {
    log.debug({ channel: m.channel_id }, 'discord guild msg dropped: no scope, no @-mention');
    return;
  }
  if (bootstrapped.has(m.message_id)) return;
  bootstrapped.add(m.message_id);

  const parsed = parseAgentSuffix(m.text);
  const choice = pickAgent(null, parsed.kind);
  if ('error' in choice) {
    await postErrorMessage(m.channel_id, choice.error);
    return;
  }
  const agentForBootstrap = available[choice.kind]!;
  const agentThreadId = await agentForBootstrap.createThread();
  const threadName = makeThreadName(parsed.cleanText, agentThreadId);
  log.info({ parent: m.channel_id, agent: choice.kind, thread: agentThreadId, threadName }, 'discord: bootstrapping new scope from @-mention');
  const threadId = await discord.createThreadFromMessage(m.channel_id, m.message_id, threadName);
  setAgentThread(discordScopeKey(threadId), choice.kind, agentThreadId);
  log.info({ discord: threadId, agent: choice.kind, thread: agentThreadId }, 'scope created');

  await handleTurn(parsed.cleanText, choice.kind, agentThreadId, discordAdapter(threadId), discordScheduler);
}

async function onTelegramInbound(m: telegram.InboundMessage): Promise<void> {
  // Allow DMs and any chat in a forum supergroup (custom topics + General).
  // Plain (non-forum) groups are skipped — no thread boundary, so per-scope
  // routing would lump every conversation together.
  if (!m.is_private && !m.in_forum) {
    log.debug({ chat: m.chat_id }, 'telegram: dropped — non-private, non-forum chat');
    return;
  }

  const scopeKey = telegramScopeKey(m.chat_id, m.message_thread_id);
  const cachedHasAnyAgent = !!(getAgentThread(scopeKey, 'codex') ?? getAgentThread(scopeKey, 'claude'));

  // No scope yet, not a DM, and no @-mention → drop. (DMs implicitly count
  // as mentions, so they always bootstrap.)
  if (!cachedHasAnyAgent && !m.is_private && !m.mentions_bot) {
    log.debug({ chat: m.chat_id, topic: m.message_thread_id }, 'telegram: dropped — no scope, no @-mention');
    return;
  }

  const parsed = parseAgentSuffix(m.text);
  const choice = pickAgent(cachedHasAnyAgent ? scopeKey : null, parsed.kind);
  if ('error' in choice) {
    await postTelegramError(m.chat_id, m.message_thread_id, choice.error);
    return;
  }

  setLastSeen(scopeKey, String(m.message_id));
  let agentThreadId = getAgentThread(scopeKey, choice.kind);
  if (!agentThreadId) {
    agentThreadId = await available[choice.kind]!.createThread();
    setAgentThread(scopeKey, choice.kind, agentThreadId);
    log.info({ scope: scopeKey, agent: choice.kind, thread: agentThreadId }, 'telegram: allocated agent session');
  } else {
    setLastAgent(scopeKey, choice.kind);
  }

  await handleTurn(
    parsed.cleanText,
    choice.kind,
    agentThreadId,
    telegramAdapter(m.chat_id, m.message_thread_id),
    telegramScheduler,
  );
}

async function postTelegramError(chatId: number, threadId: number | undefined, message: string): Promise<void> {
  try {
    await telegram.sendMessage(chatId, threadId, `⚠️ ${message}`);
  } catch (err) {
    log.warn({ err: errMsg(err) }, 'failed to post telegram error');
  }
}

async function postErrorMessage(channelId: string, message: string): Promise<void> {
  try {
    await discord.sendMessage(channelId, `⚠️ ${message}`);
  } catch (err) {
    log.warn({ err: errMsg(err) }, 'failed to post error message');
  }
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
 * through the provided platform adapter. If a turn is already in flight
 * for this thread, append to the per-thread queue and let the current
 * turn's drain pick it up.
 */
async function handleTurn(
  text: string,
  kind: AgentKind,
  agentThreadId: string,
  adapter: StreamAdapter,
  scheduler: StreamScheduler,
): Promise<void> {
  const agent = available[kind];
  if (!agent) {
    // Shouldn't happen — the caller's pickAgent() already filters this —
    // but log defensively so it's not silent.
    log.warn({ kind, agent: agentThreadId }, 'handleTurn called for unavailable agent');
    return;
  }

  const dispatch = (t: string): Promise<void> => handleTurn(t, kind, agentThreadId, adapter, scheduler);

  if (inFlight.has(agentThreadId)) {
    const q = queued.get(agentThreadId);
    if (q) q.texts.push(text);
    else queued.set(agentThreadId, { texts: [text], dispatch });
    log.debug({ agent: agentThreadId, queueDepth: queued.get(agentThreadId)!.texts.length }, 'queued follow-up turn');
    return;
  }
  inFlight.add(agentThreadId);

  const stream = new StreamingMessage(adapter, scheduler);

  const finishAndDrain = async (): Promise<void> => {
    await stream.finalize();
    inFlight.delete(agentThreadId);
    const q = queued.get(agentThreadId);
    if (!q || q.texts.length === 0) return;
    queued.delete(agentThreadId);
    const combined = q.texts.join('\n\n');
    log.debug({ agent: agentThreadId, batched: q.texts.length }, 'draining queued follow-ups');
    await q.dispatch(combined).catch(err => log.warn({ err: errMsg(err) }, 'queued turn failed'));
  };

  const callbacks: AgentTurnCallbacks = {
    onDelta: d => stream.appendDelta(d),
    onToolStart: (_kind, summary) => stream.setStatus(summary),
    onToolEnd: () => stream.setStatus(null),
    onComplete: () => { void finishAndDrain(); },
    onError: err => {
      log.warn({ err: errMsg(err) }, 'agent turn failed');
      stream.appendError(errMsg(err) || 'agent turn failed');
      void finishAndDrain();
    },
  };

  await agent.sendTurn(agentThreadId, text, callbacks);
}

function discordAdapter(channelId: string): StreamAdapter {
  return {
    send: t => discord.sendMessage(channelId, t),
    edit: async (id, t) => { await discord.editMessage(channelId, id, t); },
  };
}

function telegramAdapter(chatId: number, topicId: number | undefined): StreamAdapter {
  return {
    send: async t => String(await telegram.sendMessage(chatId, topicId, t)),
    edit: async (id, t) => { await telegram.editMessageText(chatId, Number(id), t); },
  };
}

let shuttingDown = false;
async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info('orchestrator shutting down');
  await Promise.allSettled([
    available.codex?.stop().catch(err => log.warn({ err: errMsg(err) }, 'codex shutdown failed')),
    available.claude?.stop().catch(err => log.warn({ err: errMsg(err) }, 'claude shutdown failed')),
  ]);
  if (platforms.discord) await discord.shutdownGateway().catch(err => log.warn({ err: errMsg(err) }, 'discord shutdown failed'));
  if (platforms.telegram) await telegram.shutdownPolling().catch(err => log.warn({ err: errMsg(err) }, 'telegram shutdown failed'));
  process.exit(0);
}
process.stdin.on('end', shutdown);
process.stdin.on('close', shutdown);
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await main();
