/** Per-machine caches: seen lines (lines.json) + bot ids (bot-ids.json). */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { errMsg, log } from './log.js';
import { STATE_DIR } from './paths.js';
import type { Line } from './lines.js';

type Entry = { createdAt: string; lastSeenAt?: string; name?: string };
type Cache = Record<string, Entry>;

const cacheFile = join(STATE_DIR, 'lines.json');
const FLUSH_DELAY_MS = 5_000;

let cache: Cache | null = null;
let dirty = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function read(): Cache {
  if (cache) return cache;
  if (!existsSync(cacheFile)) return cache = {};
  try { cache = JSON.parse(readFileSync(cacheFile, 'utf8')) as Cache; }
  catch (err) {
    log.warn({ err: errMsg(err), path: cacheFile }, 'lines cache read failed; treating as empty');
    cache = {};
  }
  return cache;
}

function flush(): void {
  if (!dirty || !cache) return;
  try { writeFileSync(cacheFile, JSON.stringify(cache, null, 2)); dirty = false; }
  catch (err) { log.warn({ err: errMsg(err), path: cacheFile }, 'lines cache write failed'); }
}

process.on('exit', flush);

export function noteSeen(line: Line, name?: string): void {
  const c = read();
  const entry = c[line] ??= { createdAt: new Date().toISOString() };
  entry.lastSeenAt = new Date().toISOString();
  if (name && entry.name !== name) entry.name = name;
  dirty = true;
  if (!flushTimer) flushTimer = setTimeout(() => { flushTimer = null; flush(); }, FLUSH_DELAY_MS);
}

export const listLines = (): Array<{ line: Line; entry: Entry }> =>
  Object.entries(read()).map(([line, entry]) => ({ line: line as Line, entry }));

/** Bot identity cache: `{discord: "<userId>", telegram: "<userId>"}`. Daemon writes after getMe(). */
const botIdsFile = join(STATE_DIR, 'bot-ids.json');
type BotIds = Record<string, string>;

export const readBotIds = (): BotIds => {
  try { return existsSync(botIdsFile) ? JSON.parse(readFileSync(botIdsFile, 'utf8')) as BotIds : {}; }
  catch { return {}; }
};

export function saveBotId(station: string, id: string): void {
  const cur = readBotIds();
  if (cur[station] === id) return;
  cur[station] = id;
  try { writeFileSync(botIdsFile, JSON.stringify(cur, null, 2)); }
  catch (err) { log.warn({ err: errMsg(err) }, 'bot-ids cache write failed'); }
}
