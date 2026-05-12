/** Dispatcher: owns chat stations + agent stations; routes inbounds (suffix "with X" overrides line default). */

import { copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pkg from '../package.json' with { type: 'json' };
import { ClaudeStation } from './stations/claude/index.js';
import { CodexStation } from './stations/codex/index.js';
import { DiscordStation, type DiscordMeta } from './stations/discord/index.js';
import { GitHubStation, type GitHubMeta } from './stations/github/index.js';
import { TelegramStation, type TelegramMeta } from './stations/telegram/index.js';
import type { AgentStation, ChatStation, InboundMessage, Line as LineT } from './stations/types.js';
import {
  type AgentKind, getAgentThread, getLastAgent, linesForStation,
  setAgentThread, setLastAgent, setLastSeen, setName,
} from './helpers/scope-cache.js';
import { StreamScheduler, type StreamAdapter } from './helpers/streaming.js';
import { runTurn, triggerStop } from './helpers/turn.js';
import { errMsg, log } from './log.js';
import { acquireLock, configuredPlatforms, loadMetroEnv, STATE_DIR, requireConfiguredPlatform } from './paths.js';

loadMetroEnv();
const platforms = configuredPlatforms();
requireConfiguredPlatform(platforms);
acquireLock(join(STATE_DIR, '.tail-lock'));

/** Install AGENTS.md skill into state dir so the agent has a stable path to consult. Refreshed every start so upgrades land. */
const AGENTS_MD = join(STATE_DIR, 'AGENTS.md');
try { copyFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'agents.md'), AGENTS_MD); }
catch (err) { log.warn({ err: errMsg(err) }, 'failed to install agent skill'); }

const bootstrapped = new Set<string>();
const codex = new CodexStation(pkg.version);
const claude = new ClaudeStation();
const discord = new DiscordStation();
const telegram = new TelegramStation();
const github = new GitHubStation();
const available: Partial<Record<AgentKind, AgentStation>> = {};
const scheduler = new StreamScheduler();

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
async function dispatch(line: LineT, text: string, attachments: InboundMessage['attachments'], kind: AgentKind, messageId: string, adapter: StreamAdapter, lineName?: string): Promise<void> {
  setLastSeen(line, messageId);
  let threadId = getAgentThread(line, kind);
  if (threadId) setLastAgent(line, kind);
  else { threadId = await available[kind]!.createThread(); setAgentThread(line, kind, threadId); log.info({ line, agent: kind, thread: threadId }, 'allocated agent session'); }
  if (lineName) setName(line, lineName);
  await runTurn(available[kind]!, threadId, withContext(line, text), attachments, adapter, scheduler);
}

/** Tell the agent its line + the one rule: write normally to reply here, only use `metro send` for OTHER lines. */
const withContext = (line: LineT, text: string): string =>
  `[metro: this turn is on ${line}. To reply HERE just write text — metro streams it back automatically; do NOT use \`metro send\` for this line. Use \`metro send <other-line> <text>\` only to post to a DIFFERENT conversation (list with \`metro lines\`). Full guide: ${AGENTS_MD}]\n\n${text}`;

const adapterFor = <TMeta>(station: ChatStation<TMeta>, line: LineT): StreamAdapter => ({
  send: (t, stopId) => station.send(line, t, { stopId }),
  edit: async (id, t, stopId) => { await station.edit!(line, id, t, { stopId }); },
});

/** Bootstrap returns a fresh `Line` for the new conversation (e.g. a new Discord thread or Telegram topic). */
type Bootstrap<TMeta> = (m: InboundMessage<TMeta>, cleanText: string) => Promise<LineT | null>;

/** Dispatch into an existing agent on `m.line`, or (on `@`-mention) allocate a new session, optionally via station-specific bootstrap. */
async function routeInbound<TMeta>(m: InboundMessage<TMeta>, station: ChatStation<TMeta>, bootstrap: Bootstrap<TMeta> | null): Promise<void> {
  const hasAgent = !!(getAgentThread(m.line, 'codex') ?? getAgentThread(m.line, 'claude'));
  const { kind: req, cleanText } = parseAgentSuffix(m.text);
  const postErr = (msg: string): Promise<void> => station.send(m.line, `⚠️ ${msg}`).then(() => {}).catch(err => log.warn({ err: errMsg(err), station: station.name }, 'error post failed'));

  if (hasAgent) {
    const c = pickAgent(m.line, req);
    return 'error' in c ? postErr(c.error) : dispatch(m.line, cleanText, m.attachments, c.kind, m.messageId, adapterFor(station, m.line), m.lineName);
  }
  if (!m.mentionsBot || bootstrapped.has(m.messageId)) return;
  bootstrapped.add(m.messageId);
  const choice = pickAgent(null, req);
  if ('error' in choice) return postErr(choice.error);
  /** Bootstrap creates a new chat-side scope (Discord thread / Telegram topic) — we know its name from `cleanText`. */
  const line = bootstrap ? await bootstrap(m, cleanText).catch(err => { log.warn({ err: errMsg(err), station: station.name }, 'bootstrap failed'); return null; }) : m.line;
  if (!line) return;
  await dispatch(line, cleanText, m.attachments, choice.kind, m.messageId, adapterFor(station, line), bootstrap ? makeThreadName(cleanText) : m.lineName);
}

const onDiscordInbound = (m: InboundMessage<DiscordMeta>): Promise<void> => {
  /** DM: the channel IS the conversation, no thread to create. Guild: bootstrap a thread on @-mention. */
  if (!m.meta.inGuild) return routeInbound(m, discord, null);
  return routeInbound(m, discord, (m, cleanText) => discord.createThreadFromMessage(m.line, m.messageId, makeThreadName(cleanText)));
};

const onTelegramInbound = (m: InboundMessage<TelegramMeta>): Promise<void> => {
  if (!m.meta.isPrivate && !m.meta.inForum) return Promise.resolve();
  /** Forum General → bootstrap a new topic; private/topic → route into `m.line`. */
  if (m.meta.inForum && !m.meta.isForumTopic) return routeInbound(m, telegram, telegramTopicBootstrap);
  return routeInbound(m, telegram, null);
};

const telegramTopicBootstrap: Bootstrap<TelegramMeta> = async (m, cleanText) => {
  const topicName = makeThreadName(cleanText);
  let topicLine: LineT;
  try { topicLine = await telegram.createForumTopic(m.line, topicName); }
  catch (err) { await telegram.send(m.line, `⚠️ couldn't create topic — bot needs Manage Topics admin permission. (${errMsg(err)})`).catch(() => {}); return null; }
  /** Post a deep link back in General as a reply to the @-mention so it threads visually. */
  const link = telegram.topicLink(topicLine);
  if (link) await telegram.send(m.line, `→ [${topicName}](${link})`, { replyTo: m.messageId }).catch(err => log.warn({ err: errMsg(err) }, 'telegram: failed to post topic link in General'));
  return topicLine;
};

const onGithubInbound = (m: InboundMessage<GitHubMeta>): Promise<void> => {
  /** Prepend issue/PR context so the agent has it without us bridging to a different chat. */
  const header = `**@${m.meta.authorUsername}** on GitHub ${m.meta.isPR ? 'PR' : 'issue'} ${m.meta.repoFullName}#${m.meta.issueNumber} (<${m.meta.url}>):`;
  return routeInbound({ ...m, text: `${header}\n\n${m.text}` }, github, null);
};

/** Strip mention syntax + normalize whitespace; cap at 100 chars (Discord limit). */
function makeThreadName(rawText: string): string {
  const cleaned = rawText.replace(/<@!?\d+>|<@&\d+>|<#\d+>|<a?:[^:]+:\d+>|@\w+/g, '').replace(/\s+/g, ' ').trim() || 'metro';
  return cleaned.length <= 100 ? cleaned : cleaned.slice(0, 99) + '…';
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
  if (github.isConfigured()) {
    await github.start();
    github.onMessage(m => void onGithubInbound(m).catch(err => log.warn({ err: errMsg(err) }, 'github inbound failed')));
  }
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
