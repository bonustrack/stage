// Per-machine cache of `scope_key → { agent thread ids, last-used }`.
// Lets orchestrator restarts rejoin the same agent conversation in the
// same Discord thread instead of starting from scratch. JSON file at
// $STATE_DIR/scopes.json.
//
// One Discord thread can have up to one session per agent kind — when a
// user explicitly switches via "with claude" / "with codex", a fresh
// session is allocated for the new kind and stored alongside.
//
// Scope keys are platform-prefixed so the same store handles Discord and
// Telegram without collisions:
//   discord:<thread_channel_id>
//   telegram:<chat_id>:<topic_id>

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { errMsg, log } from '../log.js';
import { STATE_DIR } from '../paths.js';

export type AgentKind = 'codex' | 'claude';

type Entry = {
  createdAt: string;
  /**
   * Watermark for catchup-on-restart: the id of the most recent human
   * message metro has processed in this scope. After a restart, REST is
   * used to fetch anything newer than this and replay it through the
   * orchestrator.
   */
  lastSeenMessageId?: string;
  /** Per-agent session ids. A scope can have one of each. */
  agents: Partial<Record<AgentKind, string>>;
  /** Which agent answered most recently — the default for the next turn. */
  lastAgent?: AgentKind;
};
type Cache = Record<string, Entry>;

const cacheFile = join(STATE_DIR, 'scopes.json');

function read(): Cache {
  if (!existsSync(cacheFile)) return {};
  try {
    return JSON.parse(readFileSync(cacheFile, 'utf8')) as Cache;
  } catch (err) {
    log.warn({ err: errMsg(err), path: cacheFile }, 'scope cache read failed; treating as empty');
    return {};
  }
}

function write(cache: Cache): void {
  try {
    writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
  } catch (err) {
    log.warn({ err: errMsg(err), path: cacheFile }, 'scope cache write failed');
  }
}

function ensure(cache: Cache, scopeKey: string): Entry {
  if (!cache[scopeKey]) cache[scopeKey] = { createdAt: new Date().toISOString(), agents: {} };
  if (!cache[scopeKey].agents) cache[scopeKey].agents = {};
  return cache[scopeKey];
}

export function getAgentThread(scopeKey: string, kind: AgentKind): string | undefined {
  return read()[scopeKey]?.agents?.[kind];
}

export function setAgentThread(scopeKey: string, kind: AgentKind, threadId: string): void {
  const cache = read();
  const entry = ensure(cache, scopeKey);
  entry.agents[kind] = threadId;
  entry.lastAgent = kind;
  write(cache);
}

export function getLastAgent(scopeKey: string): AgentKind | undefined {
  return read()[scopeKey]?.lastAgent;
}

export function setLastAgent(scopeKey: string, kind: AgentKind): void {
  const cache = read();
  if (!cache[scopeKey]) return;
  cache[scopeKey].lastAgent = kind;
  write(cache);
}

export function setLastSeen(scopeKey: string, messageId: string): void {
  const cache = read();
  if (!cache[scopeKey]) return;
  cache[scopeKey].lastSeenMessageId = messageId;
  write(cache);
}

export function listScopes(): Array<{ scopeKey: string; entry: Entry }> {
  return Object.entries(read()).map(([scopeKey, entry]) => ({ scopeKey, entry }));
}

export function discordScopeKey(threadChannelId: string): string {
  return `discord:${threadChannelId}`;
}

export function discordChannelFromScopeKey(scopeKey: string): string | null {
  return scopeKey.startsWith('discord:') ? scopeKey.slice('discord:'.length) : null;
}
