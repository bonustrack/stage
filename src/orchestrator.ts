/** Daemon: owns Discord gateway + Telegram poller; routes inbounds to codex/claude (suffix "with X" overrides scope default). */

import { join } from 'node:path';
import pkg from '../package.json' with { type: 'json' };
import * as discord from './channels/discord.js';
import * as github from './channels/github.js';
import * as telegram from './channels/telegram.js';
import { CodexAgent } from './agents/codex.js';
import { ClaudeAgent } from './agents/claude.js';
import type { Agent, Attachment } from './agents/types.js';
import {
  type AgentKind, discordChannelFromScopeKey, discordScopeKey, getAgentThread,
  getLastAgent, listScopes, setAgentThread, setLastAgent, setLastSeen, telegramScopeKey,
} from './helpers/scope-cache.js';
import { StreamScheduler, type StreamAdapter } from './helpers/streaming.js';
import { startGithubBridge } from './helpers/github-router.js';
import { runTurn, triggerStop } from './helpers/turn.js';
import { errMsg, log } from './log.js';
import { acquireLock, configuredPlatforms, loadMetroEnv, STATE_DIR, requireConfiguredPlatform } from './paths.js';

loadMetroEnv();
const platforms = configuredPlatforms();
requireConfiguredPlatform(platforms);
acquireLock(join(STATE_DIR, '.tail-lock'));

const bootstrapped = new Set<string>();
const codexAgent = new CodexAgent(pkg.version);
const claudeAgent = new ClaudeAgent();
const available: Partial<Record<AgentKind, Agent>> = {};
const discordScheduler = new StreamScheduler();
const telegramScheduler = new StreamScheduler();

async function startAgents(): Promise<void> {
  await Promise.allSettled([
    codexAgent.start().then(() => { available.codex = codexAgent; }).catch(err => log.warn({ err: errMsg(err) }, 'codex unavailable')),
    claudeAgent.start().then(() => { available.claude = claudeAgent; }).catch(err => log.warn({ err: errMsg(err) }, 'claude unavailable')),
  ]);
  if (!Object.keys(available).length) { log.fatal('no agents available'); process.exit(2); }
  log.info({ agents: Object.keys(available) }, 'agents ready');
}

const SUFFIX_RE = /(?:^|\s)with\s+(claude|codex)\s*$/i;
function parseAgentSuffix(text: string): { kind: AgentKind | null; cleanText: string } {
  const t = text.trimEnd();
  const m = SUFFIX_RE.exec(t);
  return m ? { kind: m[1].toLowerCase() as AgentKind, cleanText: t.slice(0, m.index).trimEnd() } : { kind: null, cleanText: text };
}

function pickAgent(scopeKey: string | null, req: AgentKind | null): { kind: AgentKind } | { error: string } {
  if (req) return available[req] ? { kind: req } : { error: `${req} is not available on this metro instance` };
  const last = scopeKey ? getLastAgent(scopeKey) : undefined;
  if (last && available[last]) return { kind: last };
  if (available.claude) return { kind: 'claude' };
  if (available.codex) return { kind: 'codex' };
  return { error: 'no agents available' };
}

/** Resolve agent session for `scopeKey`, allocating if new, then run the turn. */
async function dispatch(scopeKey: string, text: string, attachments: Attachment[], kind: AgentKind, messageId: string, adapter: StreamAdapter, scheduler: StreamScheduler): Promise<void> {
  setLastSeen(scopeKey, messageId);
  let threadId = getAgentThread(scopeKey, kind);
  if (threadId) setLastAgent(scopeKey, kind);
  else { threadId = await available[kind]!.createThread(); setAgentThread(scopeKey, kind, threadId); log.info({ scope: scopeKey, agent: kind, thread: threadId }, 'allocated agent session'); }
  await runTurn(available[kind]!, threadId, text, attachments, adapter, scheduler);
}

async function onDiscordInbound(m: discord.InboundMessage): Promise<void> {
  if (!m.in_guild) return;
  const scope = discordScopeKey(m.channel_id);
  const hasAgent = !!(getAgentThread(scope, 'codex') ?? getAgentThread(scope, 'claude'));
  const { kind: req, cleanText } = parseAgentSuffix(m.text);
  const postErr = (msg: string): Promise<void> => discord.sendMessage(m.channel_id, `⚠️ ${msg}`).then(() => {}).catch(err => log.warn({ err: errMsg(err) }, 'discord error post failed'));

  if (hasAgent) {
    const c = pickAgent(scope, req);
    return 'error' in c ? postErr(c.error) : dispatch(scope, cleanText, m.attachments, c.kind, m.message_id, discordAdapter(m.channel_id), discordScheduler);
  }
  if (!m.mentions_bot || bootstrapped.has(m.message_id)) return;
  bootstrapped.add(m.message_id);
  const choice = pickAgent(null, req);
  if ('error' in choice) return postErr(choice.error);
  const threadId = await available[choice.kind]!.createThread();
  const ch = await discord.createThreadFromMessage(m.channel_id, m.message_id, makeThreadName(cleanText, threadId));
  setAgentThread(discordScopeKey(ch), choice.kind, threadId);
  await runTurn(available[choice.kind]!, threadId, cleanText, m.attachments, discordAdapter(ch), discordScheduler);
}

async function onTelegramInbound(m: telegram.InboundMessage): Promise<void> {
  if (!m.is_private && !m.in_forum) return;
  if (m.in_forum && !m.is_forum_topic) return bootstrapForumTopic(m);
  const scope = telegramScopeKey(m.chat_id, m.message_thread_id);
  const hasAgent = !!(getAgentThread(scope, 'codex') ?? getAgentThread(scope, 'claude'));
  if (!hasAgent && !m.is_private && !m.mentions_bot) return;
  const { kind: req, cleanText } = parseAgentSuffix(m.text);
  const choice = pickAgent(hasAgent ? scope : null, req);
  if ('error' in choice) return postTelegramError(m.chat_id, m.message_thread_id, choice.error);
  await dispatch(scope, cleanText, m.attachments, choice.kind, String(m.message_id), telegramAdapter(m.chat_id, m.message_thread_id), telegramScheduler);
}

async function bootstrapForumTopic(m: telegram.InboundMessage): Promise<void> {
  if (!m.mentions_bot || bootstrapped.has(String(m.message_id))) return;
  bootstrapped.add(String(m.message_id));
  const { kind: req, cleanText } = parseAgentSuffix(m.text);
  const choice = pickAgent(null, req);
  if ('error' in choice) return postTelegramError(m.chat_id, undefined, choice.error);
  const topicName = makeThreadName(cleanText, 'metro');
  let topicId: number;
  try { topicId = await telegram.createForumTopic(m.chat_id, topicName); }
  catch (err) { return postTelegramError(m.chat_id, undefined, `couldn't create topic — bot needs Manage Topics admin permission. (${errMsg(err)})`); }
  const threadId = await available[choice.kind]!.createThread();
  const scope = telegramScopeKey(m.chat_id, topicId);
  setAgentThread(scope, choice.kind, threadId); setLastSeen(scope, String(m.message_id));
  log.info({ scope, agent: choice.kind, thread: threadId }, 'telegram: scope created');
  /** Post a deep link back in General as a reply to the @-mention so it threads visually. */
  await telegram.sendMessage(m.chat_id, undefined, `→ [${topicName}](${telegram.topicLink(m.chat_id, topicId)})`, m.message_id)
    .catch(err => log.warn({ err: errMsg(err) }, 'telegram: failed to post topic link in General'));
  await runTurn(available[choice.kind]!, threadId, cleanText, m.attachments, telegramAdapter(m.chat_id, topicId), telegramScheduler);
}

async function postTelegramError(chatId: number, threadId: number | undefined, message: string): Promise<void> {
  try { await telegram.sendMessage(chatId, threadId, `⚠️ ${message}`); }
  catch (err) { log.warn({ err: errMsg(err) }, 'failed to post telegram error'); }
}

/** Strip mention syntax + normalize whitespace; cap at 100 chars (Discord limit). */
function makeThreadName(rawText: string, fallback: string): string {
  const cleaned = rawText.replace(/<@!?\d+>|<@&\d+>|<#\d+>|<a?:[^:]+:\d+>|@\w+/g, '').replace(/\s+/g, ' ').trim();
  const out = cleaned || fallback;
  return out.length <= 100 ? out : out.slice(0, 99) + '…';
}

function discordAdapter(channelId: string): StreamAdapter {
  return {
    send: (t, stopId) => discord.sendMessage(channelId, t, stopId),
    edit: async (id, t, stopId) => { await discord.editMessage(channelId, id, t, stopId); },
  };
}

function telegramAdapter(chatId: number, topicId: number | undefined): StreamAdapter {
  return {
    send: async (t, stopId) => String(await telegram.sendMessage(chatId, topicId, t, undefined, stopId)),
    edit: async (id, t, stopId) => { await telegram.editMessageText(chatId, Number(id), t, stopId); },
  };
}

async function catchupDiscord(): Promise<void> {
  for (const { scopeKey, entry } of listScopes()) {
    const channelId = discordChannelFromScopeKey(scopeKey);
    if (!channelId || !entry.lastSeenMessageId) continue;
    try {
      const missed = (await discord.fetchMessagesSince(channelId, entry.lastSeenMessageId)).filter(m => !m.author_is_bot && m.text);
      if (!missed.length) continue;
      log.info({ channel: channelId, count: missed.length }, 'discord catchup');
      for (const m of missed) await onDiscordInbound({ channel_id: channelId, message_id: m.message_id, text: m.text, attachments: [], in_guild: true, mentions_bot: false });
    } catch (err) { log.warn({ err: errMsg(err), channel: channelId }, 'discord catchup skipped'); }
  }
}

/** github router calls back into the existing dispatch path; picks the scope's last-used agent (default claude). */
const githubDispatch = (s: string, t: string, m: string, c: string): Promise<void> => {
  const choice = pickAgent(s, null); const kind = 'error' in choice ? 'claude' : choice.kind;
  return dispatch(s, t, [], kind, m, discordAdapter(c), discordScheduler);
};

async function main(): Promise<void> {
  await startAgents();
  if (platforms.discord) {
    await discord.startGateway();
    log.info({ bot: (await discord.getMe()).username }, 'discord ready');
    discord.onInbound(m => void onDiscordInbound(m).catch(err => log.warn({ err: errMsg(err) }, 'discord inbound failed')));
    discord.onStop(triggerStop);
    void catchupDiscord().catch(err => log.warn({ err: errMsg(err) }, 'discord catchup failed'));
  }
  if (platforms.telegram) {
    log.info({ bot: `@${(await telegram.getMe()).username}` }, 'telegram ready');
    telegram.onInbound(m => void onTelegramInbound(m).catch(err => log.warn({ err: errMsg(err) }, 'telegram inbound failed')));
    telegram.onStop(triggerStop);
    await telegram.startPolling();
  }
  await startGithubBridge(platforms.discord, { dispatch: githubDispatch });
  log.info('orchestrator ready');
}

let shuttingDown = false;
async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info('orchestrator shutting down');
  await Promise.allSettled([available.codex?.stop(), available.claude?.stop()]);
  if (platforms.discord) await discord.shutdownGateway().catch(() => {});
  if (platforms.telegram) await telegram.shutdownPolling().catch(() => {});
  await github.stop().catch(() => {});
  process.exit(0);
}
process.stdin.on('end', shutdown);
process.stdin.on('close', shutdown);
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await main();
