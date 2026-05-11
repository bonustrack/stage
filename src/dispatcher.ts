/** Dispatcher: owns chat stations + agent stations; routes inbounds (suffix "with X" overrides scope default). */

import { join } from 'node:path';
import pkg from '../package.json' with { type: 'json' };
import { ClaudeStation } from './stations/claude/index.js';
import { CodexStation } from './stations/codex/index.js';
import { DiscordStation, type DiscordMeta } from './stations/discord/index.js';
import { GitHubStation } from './stations/github/index.js';
import { TelegramStation, type TelegramMeta } from './stations/telegram/index.js';
import type { AgentStation, Attachment, ChatStation, InboundMessage, Line as LineT } from './stations/types.js';
import {
  type AgentKind, getAgentThread, getLastAgent, linesForStation,
  setAgentThread, setLastAgent, setLastSeen,
} from './helpers/scope-cache.js';
import { StreamScheduler, type StreamAdapter } from './helpers/streaming.js';
import { startGithubBridge } from './stations/github/router.js';
import { runTurn, triggerStop } from './helpers/turn.js';
import { errMsg, log } from './log.js';
import { acquireLock, configuredPlatforms, loadMetroEnv, STATE_DIR, requireConfiguredPlatform } from './paths.js';

loadMetroEnv();
const platforms = configuredPlatforms();
requireConfiguredPlatform(platforms);
acquireLock(join(STATE_DIR, '.tail-lock'));

const bootstrapped = new Set<string>();
const codex = new CodexStation(pkg.version);
const claude = new ClaudeStation();
const discord = new DiscordStation();
const telegram = new TelegramStation();
const github = new GitHubStation();
const available: Partial<Record<AgentKind, AgentStation>> = {};
const discordScheduler = new StreamScheduler();
const telegramScheduler = new StreamScheduler();

async function startAgents(): Promise<void> {
  await Promise.allSettled([
    codex.start().then(() => { available.codex = codex; }).catch(err => log.warn({ err: errMsg(err) }, 'codex unavailable')),
    claude.start().then(() => { available.claude = claude; }).catch(err => log.warn({ err: errMsg(err) }, 'claude unavailable')),
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

function pickAgent(line: LineT | null, req: AgentKind | null): { kind: AgentKind } | { error: string } {
  if (req) return available[req] ? { kind: req } : { error: `${req} is not available on this metro instance` };
  const last = line ? getLastAgent(line) : undefined;
  if (last && available[last]) return { kind: last };
  if (available.claude) return { kind: 'claude' };
  if (available.codex) return { kind: 'codex' };
  return { error: 'no agents available' };
}

/** Resolve agent session for `line`, allocating if new, then run the turn. */
async function dispatch(line: LineT, text: string, attachments: Attachment[], kind: AgentKind, messageId: string, adapter: StreamAdapter, scheduler: StreamScheduler): Promise<void> {
  setLastSeen(line, messageId);
  let threadId = getAgentThread(line, kind);
  if (threadId) setLastAgent(line, kind);
  else { threadId = await available[kind]!.createThread(); setAgentThread(line, kind, threadId); log.info({ line, agent: kind, thread: threadId }, 'allocated agent session'); }
  await runTurn(available[kind]!, threadId, text, attachments, adapter, scheduler);
}

function adapterFor(station: ChatStation, line: LineT): StreamAdapter {
  return {
    send: (t, stopId) => station.send(line, t, { stopId }),
    edit: async (id, t, stopId) => { await station.edit!(line, id, t, { stopId }); },
  };
}

async function onDiscordInbound(m: InboundMessage<DiscordMeta>): Promise<void> {
  if (!m.meta.inGuild) return;
  const hasAgent = !!(getAgentThread(m.line, 'codex') ?? getAgentThread(m.line, 'claude'));
  const { kind: req, cleanText } = parseAgentSuffix(m.text);
  const postErr = (msg: string): Promise<void> => discord.send(m.line, `⚠️ ${msg}`).then(() => {}).catch(err => log.warn({ err: errMsg(err) }, 'discord error post failed'));

  if (hasAgent) {
    const c = pickAgent(m.line, req);
    return 'error' in c ? postErr(c.error) : dispatch(m.line, cleanText, m.attachments, c.kind, m.messageId, adapterFor(discord, m.line), discordScheduler);
  }
  if (!m.mentionsBot || bootstrapped.has(m.messageId)) return;
  bootstrapped.add(m.messageId);
  const choice = pickAgent(null, req);
  if ('error' in choice) return postErr(choice.error);
  const threadId = await available[choice.kind]!.createThread();
  const threadLine = await discord.createThreadFromMessage(m.line, m.messageId, makeThreadName(cleanText, threadId));
  setAgentThread(threadLine, choice.kind, threadId);
  await runTurn(available[choice.kind]!, threadId, cleanText, m.attachments, adapterFor(discord, threadLine), discordScheduler);
}

async function onTelegramInbound(m: InboundMessage<TelegramMeta>): Promise<void> {
  if (!m.meta.isPrivate && !m.meta.inForum) return;
  if (m.meta.inForum && !m.meta.isForumTopic) return bootstrapForumTopic(m);
  const hasAgent = !!(getAgentThread(m.line, 'codex') ?? getAgentThread(m.line, 'claude'));
  if (!hasAgent && !m.meta.isPrivate && !m.mentionsBot) return;
  const { kind: req, cleanText } = parseAgentSuffix(m.text);
  const choice = pickAgent(hasAgent ? m.line : null, req);
  if ('error' in choice) return postTelegramError(m.line, choice.error);
  await dispatch(m.line, cleanText, m.attachments, choice.kind, m.messageId, adapterFor(telegram, m.line), telegramScheduler);
}

async function bootstrapForumTopic(m: InboundMessage<TelegramMeta>): Promise<void> {
  if (!m.mentionsBot || bootstrapped.has(m.messageId)) return;
  bootstrapped.add(m.messageId);
  const { kind: req, cleanText } = parseAgentSuffix(m.text);
  const choice = pickAgent(null, req);
  if ('error' in choice) return postTelegramError(m.line, choice.error);
  const topicName = makeThreadName(cleanText, 'metro');
  let topicLine: LineT;
  try { topicLine = await telegram.createForumTopic(m.line, topicName); }
  catch (err) { return postTelegramError(m.line, `couldn't create topic — bot needs Manage Topics admin permission. (${errMsg(err)})`); }
  const threadId = await available[choice.kind]!.createThread();
  setAgentThread(topicLine, choice.kind, threadId); setLastSeen(topicLine, m.messageId);
  log.info({ line: topicLine, agent: choice.kind, thread: threadId }, 'telegram: line created');
  /** Post a deep link back in General as a reply to the @-mention so it threads visually. */
  const link = telegram.topicLink(topicLine);
  if (link) await telegram.send(m.line, `→ [${topicName}](${link})`, { replyTo: m.messageId })
    .catch(err => log.warn({ err: errMsg(err) }, 'telegram: failed to post topic link in General'));
  await runTurn(available[choice.kind]!, threadId, cleanText, m.attachments, adapterFor(telegram, topicLine), telegramScheduler);
}

async function postTelegramError(line: LineT, message: string): Promise<void> {
  try { await telegram.send(line, `⚠️ ${message}`); }
  catch (err) { log.warn({ err: errMsg(err) }, 'failed to post telegram error'); }
}

/** Strip mention syntax + normalize whitespace; cap at 100 chars (Discord limit). */
function makeThreadName(rawText: string, fallback: string): string {
  const cleaned = rawText.replace(/<@!?\d+>|<@&\d+>|<#\d+>|<a?:[^:]+:\d+>|@\w+/g, '').replace(/\s+/g, ' ').trim();
  const out = cleaned || fallback;
  return out.length <= 100 ? out : out.slice(0, 99) + '…';
}

async function catchupDiscord(): Promise<void> {
  for (const { line, entry } of linesForStation('discord')) {
    if (!entry.lastSeenMessageId) continue;
    try {
      const missed = (await discord.fetchMessagesSince(line, entry.lastSeenMessageId)).filter(m => !m.authorIsBot && m.text);
      if (!missed.length) continue;
      log.info({ line, count: missed.length }, 'discord catchup');
      for (const m of missed) await onDiscordInbound({ station: 'discord', line, messageId: m.messageId, text: m.text, attachments: [], mentionsBot: false, meta: { inGuild: true } });
    } catch (err) { log.warn({ err: errMsg(err), line }, 'discord catchup skipped'); }
  }
}

/** github router calls back into the existing dispatch path; picks the line's last-used agent (default claude). */
const githubDispatch = (line: LineT, text: string, messageId: string, station: ChatStation): Promise<void> => {
  const choice = pickAgent(line, null); const kind = 'error' in choice ? 'claude' : choice.kind;
  return dispatch(line, text, [], kind, messageId, adapterFor(station, line), discordScheduler);
};

async function main(): Promise<void> {
  await startAgents();
  if (platforms.discord) {
    await discord.start();
    log.info({ bot: (await discord.getMe()).username }, 'discord ready');
    discord.onMessage(m => void onDiscordInbound(m).catch(err => log.warn({ err: errMsg(err) }, 'discord inbound failed')));
    discord.onStop(triggerStop);
    void catchupDiscord().catch(err => log.warn({ err: errMsg(err) }, 'discord catchup failed'));
  }
  if (platforms.telegram) {
    log.info({ bot: `@${(await telegram.getMe()).username}` }, 'telegram ready');
    telegram.onMessage(m => void onTelegramInbound(m).catch(err => log.warn({ err: errMsg(err) }, 'telegram inbound failed')));
    telegram.onStop(triggerStop);
    await telegram.start();
  }
  await startGithubBridge(github, platforms.discord ? discord : null, githubDispatch);
  log.info('dispatcher ready');
}

let shuttingDown = false;
async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info('dispatcher shutting down');
  await Promise.allSettled([available.codex?.stop(), available.claude?.stop()]);
  if (platforms.discord) await discord.stop().catch(() => {});
  if (platforms.telegram) await telegram.stop().catch(() => {});
  await github.stop().catch(() => {});
  process.exit(0);
}
process.stdin.on('end', shutdown);
process.stdin.on('close', shutdown);
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await main();
