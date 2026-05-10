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

type Scope = {
  discord?: string;                                   // thread channel id
  telegram?: { chat: string; topic: number };        // chat id + message_thread_id
  created_at?: string;
};
type Cache = Record<string, Scope>;

const cacheFile = join(STATE_DIR, 'scopes.json');

function readCache(): Cache {
  if (!existsSync(cacheFile)) return {};
  try {
    return JSON.parse(readFileSync(cacheFile, 'utf8')) as Cache;
  } catch (err) {
    log.warn({ err: errMsg(err), path: cacheFile }, 'scope cache read failed; treating as empty');
    return {};
  }
}

function writeCache(cache: Cache): void {
  try {
    writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
  } catch (err) {
    log.warn({ err: errMsg(err), path: cacheFile }, 'scope cache write failed');
  }
}

export async function resolveDiscordScope(
  name: string,
  parentChannelId: string,
  create: (parentChannelId: string, name: string) => Promise<string>,
): Promise<string> {
  const cache = readCache();
  const cached = cache[name]?.discord;
  if (cached) {
    log.debug({ name, thread: cached }, 'discord scope cached; reusing');
    return cached;
  }
  log.info({ name, parent: parentChannelId }, 'creating discord thread for session');
  const id = await create(parentChannelId, name);
  cache[name] = { ...cache[name], discord: id, created_at: cache[name]?.created_at ?? new Date().toISOString() };
  writeCache(cache);
  log.info({ name, thread: id }, 'discord scope cached');
  return id;
}

export async function resolveTelegramScope(
  name: string,
  parentChatId: string,
  create: (parentChatId: string, name: string) => Promise<number>,
): Promise<{ chat: string; topic: number }> {
  const cache = readCache();
  const cached = cache[name]?.telegram;
  if (cached) {
    log.debug({ name, ...cached }, 'telegram scope cached; reusing');
    return cached;
  }
  log.info({ name, parent: parentChatId }, 'creating telegram topic for session');
  const topic = await create(parentChatId, name);
  const scope = { chat: parentChatId, topic };
  cache[name] = { ...cache[name], telegram: scope, created_at: cache[name]?.created_at ?? new Date().toISOString() };
  writeCache(cache);
  log.info({ name, ...scope }, 'telegram scope cached');
  return scope;
}
