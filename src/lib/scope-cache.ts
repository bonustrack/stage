/** Per-machine scope→{thread ids,last-used} cache. Keys: `discord:<id>` / `telegram:<chat>:<topic>`. */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { errMsg, log } from '../log.js';
import { STATE_DIR } from '../paths.js';

export type AgentKind = 'codex' | 'claude';

type Entry = {
  createdAt: string;
  /** Watermark of most-recent processed human message; used for catchup-on-restart. */
  lastSeenMessageId?: string;
  agents: Partial<Record<AgentKind, string>>;
  /** Most-recent answering agent; default for the next turn. */
  lastAgent?: AgentKind;
};
type Cache = Record<string, Entry>;

const cacheFile = join(STATE_DIR, 'scopes.json');

function read(): Cache {
  if (!existsSync(cacheFile)) return {};
  try { return JSON.parse(readFileSync(cacheFile, 'utf8')) as Cache; }
  catch (err) { log.warn({ err: errMsg(err), path: cacheFile }, 'scope cache read failed; treating as empty'); return {}; }
}

function write(cache: Cache): void {
  try { writeFileSync(cacheFile, JSON.stringify(cache, null, 2)); }
  catch (err) { log.warn({ err: errMsg(err), path: cacheFile }, 'scope cache write failed'); }
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

export const discordScopeKey = (threadChannelId: string): string => `discord:${threadChannelId}`;
export const discordChannelFromScopeKey = (scopeKey: string): string | null =>
  scopeKey.startsWith('discord:') ? scopeKey.slice('discord:'.length) : null;
export const telegramScopeKey = (chatId: number | string, topicId: number | undefined): string =>
  `telegram:${chatId}:${topicId ?? 'main'}`;
