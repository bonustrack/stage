// Per-machine cache of `session_name → {discord_thread_id, telegram_topic}`.
// Lets `metro` reuse the same thread/topic across restarts of the same
// session, so `METRO_SESSION_NAME=frontend metro` always lands in the
// "frontend" scope instead of spawning a fresh thread on every run.
//
// Single JSON file at $STATE_DIR/scopes.json. No locking — concurrent
// launches with the same session name might double-create on first run;
// users can delete duplicates manually. KISS for now.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { errMsg, log } from '../log.js';
import { STATE_DIR } from '../paths.js';

type DiscordScope = string; // thread channel id
type TelegramScope = { chat: string; topic: number };
type Scope = {
  discord?: DiscordScope;
  telegram?: TelegramScope;
  created_at?: string;
};
type Cache = Record<string, Scope>;

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

export function getDiscordScope(name: string): DiscordScope | undefined {
  return read()[name]?.discord;
}

export function getTelegramScope(name: string): TelegramScope | undefined {
  return read()[name]?.telegram;
}

export function setDiscordScope(name: string, threadId: string): void {
  const cache = read();
  cache[name] = { ...cache[name], discord: threadId, created_at: cache[name]?.created_at ?? new Date().toISOString() };
  write(cache);
}

export function setTelegramScope(name: string, scope: TelegramScope): void {
  const cache = read();
  cache[name] = { ...cache[name], telegram: scope, created_at: cache[name]?.created_at ?? new Date().toISOString() };
  write(cache);
}

/**
 * Resolve a Telegram scope: cached if present, otherwise create via the
 * provided callback and cache. Telegram scoping requires a parent
 * supergroup id supplied in advance.
 */
export async function resolveTelegramScope(
  name: string,
  parentChatId: string,
  create: (parentChatId: string, name: string) => Promise<number>,
): Promise<TelegramScope> {
  const cached = getTelegramScope(name);
  if (cached) {
    log.debug({ name, ...cached }, 'telegram scope cached; reusing');
    return cached;
  }
  log.info({ name, parent: parentChatId }, 'creating telegram topic for session');
  const topic = await create(parentChatId, name);
  const scope = { chat: parentChatId, topic };
  setTelegramScope(name, scope);
  log.info({ name, ...scope }, 'telegram scope cached');
  return scope;
}
