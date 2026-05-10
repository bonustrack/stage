// Standalone inbound stream. Polls Telegram + connects to Discord, prints
// one JSON line per inbound message on stdout. Designed to be launched by
// an agent and observed via Bash+Monitor (Claude Code) or unified_exec
// polling (Codex).
//
// On every inbound: fires a 👀 reaction and starts a typing indicator that
// refreshes until the agent replies (signaled by `metro reply` touching
// .typing-stop/<key>) or the 60s safety cap is hit.

import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import pkg from '../package.json' with { type: 'json' };
import * as discord from './channels/discord.js';
import * as telegram from './channels/telegram.js';
import { tg } from './channels/telegram.js';
import type { Platform } from './lib/address.js';
import { CodexRC } from './lib/codex-rc.js';
import { resolveDiscordScope, resolveTelegramScope } from './lib/scope-cache.js';
import { configuredPlatforms, loadMetroEnv, STATE_DIR, requireConfiguredPlatform } from './paths.js';
import { errMsg, log } from './log.js';

loadMetroEnv();
const platforms = configuredPlatforms();
requireConfiguredPlatform(platforms);

// Telegram allows only one getUpdates poller per bot token. If another
// `metro` instance is already running, exit cleanly instead of fighting
// (409 spam). Stale lockfiles (PID dead) are reclaimed.
const LOCK_FILE = join(STATE_DIR, '.tail-lock');

function processIsAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

if (existsSync(LOCK_FILE)) {
  const pid = Number(readFileSync(LOCK_FILE, 'utf8').trim());
  if (Number.isInteger(pid) && pid > 0 && processIsAlive(pid)) {
    log.info({ pid }, 'another `metro` instance is already polling; exiting');
    process.exit(0);
  }
  try { unlinkSync(LOCK_FILE); } catch {}
}
writeFileSync(LOCK_FILE, String(process.pid));

function releaseLock(): void {
  try {
    if (existsSync(LOCK_FILE) && readFileSync(LOCK_FILE, 'utf8').trim() === String(process.pid)) {
      unlinkSync(LOCK_FILE);
    }
  } catch {}
}
process.on('exit', releaseLock);

const TYPING_DIR = join(STATE_DIR, '.typing-stop');
const TYPING_REFRESH_MS = 4_000;
const TYPING_MAX_MS = 60_000;

mkdirSync(TYPING_DIR, { recursive: true });

// Codex push channel. Set METRO_CODEX_RC to the codex app-server URL
// (typically `ws://127.0.0.1:8421` matching `codex app-server --listen
// ws://127.0.0.1:8421`) to inject each inbound into the agent's history
// via JSON-RPC `turn/start`. Codex's TUI `--remote` flag only accepts
// ws://, so the daemon, the TUI, and metro must all share the same URL.
// Unset → metro behaves exactly as before; stdout emit always runs first
// so Claude Code Monitor users are unaffected.
const codexRC = process.env.METRO_CODEX_RC ? new CodexRC(process.env.METRO_CODEX_RC, pkg.version) : null;
codexRC?.start();

// Per-session scope filters. When set, metro only emits / reacts to
// inbounds matching the configured Discord thread (a thread is just a
// channel from Discord's API perspective) or Telegram forum topic.
//
// Decision tree per platform:
//   1. METRO_DISCORD_THREAD / METRO_TELEGRAM_TOPIC explicit  → use as-is
//   2. METRO_SESSION_NAME + METRO_*_PARENT_*                 → auto-create
//      (cached at $STATE_DIR/scopes.json, reused across runs)
//   3. neither                                                → no scope filter
let DISCORD_FILTER = process.env.METRO_DISCORD_THREAD ?? null;
let TELEGRAM_FILTER = (() => {
  const raw = process.env.METRO_TELEGRAM_TOPIC;
  if (!raw) return null;
  const [chat, topic] = raw.split(':');
  const topicId = Number(topic);
  if (!chat || !Number.isInteger(topicId)) {
    log.warn({ value: raw }, 'METRO_TELEGRAM_TOPIC must be `<chat_id>:<topic_id>`; ignoring');
    return null;
  }
  return { chatId: chat, topicId };
})();

const sessionName = process.env.METRO_SESSION_NAME;
if (sessionName) {
  if (!DISCORD_FILTER && process.env.METRO_DISCORD_PARENT_CHANNEL) {
    DISCORD_FILTER = await resolveDiscordScope(sessionName, process.env.METRO_DISCORD_PARENT_CHANNEL, discord.createThread);
  }
  if (!TELEGRAM_FILTER && process.env.METRO_TELEGRAM_PARENT_CHAT) {
    const scope = await resolveTelegramScope(
      sessionName,
      process.env.METRO_TELEGRAM_PARENT_CHAT,
      (chat, name) => telegram.createForumTopic(chat, name),
    );
    TELEGRAM_FILTER = { chatId: scope.chat, topicId: scope.topic };
    // Mirror into env so cli.ts outbounds (`metro reply`, etc.) auto-thread
    // into the same topic without each agent invocation needing the
    // METRO_TELEGRAM_TOPIC env var set explicitly.
    process.env.METRO_TELEGRAM_TOPIC = `${scope.chat}:${scope.topic}`;
  }
}

if (DISCORD_FILTER) log.info({ thread: DISCORD_FILTER }, 'discord scope filter active');
if (TELEGRAM_FILTER) log.info(TELEGRAM_FILTER, 'telegram scope filter active');

const emit = (line: Record<string, unknown>) => {
  const json = JSON.stringify(line);
  process.stdout.write(`${json}\n`);
  codexRC?.push(json);
};

type TypingEntry = { platform: Platform; chat: string; started: number };
const typingActive = new Map<string, TypingEntry>();
const typingKey = (platform: Platform, chat: string) => `${platform}_${chat}`;

function fireTyping(platform: Platform, chat: string): void {
  if (platform === 'telegram') {
    const params: Record<string, unknown> = { chat_id: chat, action: 'typing' };
    if (TELEGRAM_FILTER && chat === TELEGRAM_FILTER.chatId) {
      params.message_thread_id = TELEGRAM_FILTER.topicId;
    }
    void tg('sendChatAction', params).catch(err =>
      log.warn({ err: errMsg(err) }, 'telegram typing failed'),
    );
  } else {
    void discord.sendTyping(chat).catch(err => log.warn({ err: errMsg(err) }, 'discord typing failed'));
  }
}

function startTyping(platform: Platform, chat: string): void {
  const k = typingKey(platform, chat);
  typingActive.set(k, { platform, chat, started: Date.now() });
  // Clear any stale stop signal so the new typing actually fires.
  const stopFile = join(TYPING_DIR, k);
  if (existsSync(stopFile)) {
    try { unlinkSync(stopFile); } catch {}
  }
  fireTyping(platform, chat);
}

setInterval(() => {
  const now = Date.now();
  for (const [k, e] of typingActive) {
    const stopFile = join(TYPING_DIR, k);
    if (existsSync(stopFile)) {
      try { unlinkSync(stopFile); } catch {}
      typingActive.delete(k);
      continue;
    }
    if (now - e.started > TYPING_MAX_MS) {
      typingActive.delete(k);
      continue;
    }
    fireTyping(e.platform, e.chat);
  }
}, TYPING_REFRESH_MS);

if (platforms.telegram) {
  const me = await telegram.getMe();
  log.info({ bot: `@${me.username}` }, 'telegram ready');
  telegram.onInbound(m => {
    if (TELEGRAM_FILTER && (String(m.chat_id) !== TELEGRAM_FILTER.chatId || m.message_thread_id !== TELEGRAM_FILTER.topicId)) {
      log.debug({ chat: m.chat_id, topic: m.message_thread_id }, 'telegram inbound rejected by topic filter');
      return;
    }
    void tg('setMessageReaction', {
      chat_id: m.chat_id,
      message_id: m.message_id,
      reaction: [{ type: 'emoji', emoji: '👀' }],
    }).catch(err => log.warn({ err: errMsg(err) }, 'telegram auto-react failed'));
    const chat = String(m.chat_id);
    startTyping('telegram', chat);
    emit({ platform: 'telegram', to: `telegram:${chat}/${m.message_id}`, text: m.text });
  });
  void telegram.startPolling();
}

if (platforms.discord) {
  await discord.startGateway();
  const me = await discord.getMe();
  log.info({ bot: me.username }, 'discord ready');
  discord.onInbound(m => {
    if (DISCORD_FILTER && m.channel_id !== DISCORD_FILTER) {
      log.debug({ channel: m.channel_id }, 'discord inbound rejected by thread filter');
      return;
    }
    void discord
      .setReaction(m.channel_id, m.message_id, '👀')
      .catch(err => log.warn({ err: errMsg(err) }, 'discord auto-react failed'));
    startTyping('discord', m.channel_id);
    emit({ platform: 'discord', to: `discord:${m.channel_id}/${m.message_id}`, text: m.text });
  });
}

// `process.on('exit', releaseLock)` above runs whenever process.exit is
// called. We also `await discord.shutdownGateway()` here so the bot flips
// offline immediately on SIGTERM / SIGINT instead of waiting ~45s for the
// gateway's missed-heartbeat timeout. SIGKILL bypasses this (nothing we can
// do); the lockfile auto-reclaims on the next start either way.
let shuttingDown = false;
async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  codexRC?.stop();
  if (platforms.discord) {
    await discord.shutdownGateway().catch(err => log.warn({ err: errMsg(err) }, 'discord shutdown failed'));
  }
  process.exit(0);
}
process.stdin.on('end', shutdown);
process.stdin.on('close', shutdown);
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
