import {
  closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync, writeSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { errMsg, log } from './log.js';
import type { Line } from './lines.js';

export const STATE_DIR = process.env.METRO_STATE_DIR ?? join(homedir(), '.cache', 'metro');
mkdirSync(STATE_DIR, { recursive: true });

/** Append-only JSONL message log. Single source of truth — import everywhere, never re-derive. */
export const HISTORY_FILE = join(STATE_DIR, 'history.jsonl');

const CONFIG_DIR = process.env.METRO_CONFIG_DIR ?? join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'metro');
export const CONFIG_ENV_FILE = join(CONFIG_DIR, '.env');

/** Train-owned env file. Trains read their tokens from here (passed through via process.env). */
const TRAINS_ENV_FILE = join(homedir(), '.metro', '.env');

const LINE_RE = /^\s*([A-Za-z_]\w*)\s*=\s*(.*?)\s*$/;
const QUOTED_RE = /^(['"])(.*)\1$/;

export function readDotenv(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(LINE_RE);
    if (m) out[m[1]] = m[2].replace(QUOTED_RE, '$2');
  }
  return out;
}

/** Precedence: process.env > cwd/.env > ~/.metro/.env > $METRO_CONFIG_DIR/.env. First-set wins. */
/** ~/.metro/.env is the canonical location for train credentials. */
export function loadMetroEnv(): void {
  for (const path of [join(process.cwd(), '.env'), TRAINS_ENV_FILE, CONFIG_ENV_FILE]) {
    for (const [k, v] of Object.entries(readDotenv(path))) {
      if (process.env[k] === undefined) process.env[k] = v;
    }
  }
}

/** Singleton pidfile. Exits if a live instance owns it; reclaims stale locks. */
/** Uses O_EXCL create so two near-simultaneous starts can't BOTH win the lock */
/** (the old check-then-write TOCTOU let two dispatchers race onto one socket). */
/** On EEXIST inspect the holder: alive ⇒ exit, stale ⇒ reclaim + retry. */
export function acquireLock(lockFile: string): void {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const fd = openSync(lockFile, 'wx'); // O_CREAT | O_EXCL — fails if it exists
      writeSync(fd, String(process.pid));
      closeSync(fd);
      process.on('exit', () => {
        try { if (readFileSync(lockFile, 'utf8').trim() === String(process.pid)) unlinkSync(lockFile); }
        catch { /* ignore */ }
      });
      return;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
      /** Someone holds the lock — is it alive? */
      let pid = NaN;
      try { pid = Number(readFileSync(lockFile, 'utf8').trim()); } catch { /* unreadable — treat as stale */ }
      try {
        if (Number.isInteger(pid) && pid > 0) {
          process.kill(pid, 0); // throws if dead
          log.info({ pid }, 'a healthy `metro` daemon is already running; exiting (no second dispatcher)');
          process.exit(0);
        }
      } catch { /* dead/unreadable → stale */ }
      /** Stale lock — reclaim and retry the O_EXCL create on the next loop. */
      try { unlinkSync(lockFile); } catch { /* lost the race to another reclaimer; retry */ }
    }
  }
  throw new Error(`metro: could not acquire dispatcher lock (${lockFile}) after retries`);
}

/* ──────────── caches: seen lines (lines.json) + bot ids (bot-ids.json) ──────────── */

type Entry = { createdAt: string; lastSeenAt?: string; name?: string };
type Cache = Record<string, Entry>;

const cacheFile = join(STATE_DIR, 'lines.json');
const FLUSH_DELAY_MS = 5_000;
let cache: Cache | null = null;
let dirty = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function readCache(): Cache {
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
  const c = readCache();
  const entry = c[line] ??= { createdAt: new Date().toISOString() };
  entry.lastSeenAt = new Date().toISOString();
  if (name && entry.name !== name) entry.name = name;
  dirty = true;
  if (!flushTimer) flushTimer = setTimeout(() => { flushTimer = null; flush(); }, FLUSH_DELAY_MS);
}

export const listLines = (): Array<{ line: Line; entry: Entry }> =>
  Object.entries(readCache()).map(([line, entry]) => ({ line: line as Line, entry }));

/** Bot identity cache: `{discord: "<userId>", telegram: "<userId>"}`. Trains may populate this. */
const botIdsFile = join(STATE_DIR, 'bot-ids.json');
export const readBotIds = (): Record<string, string> => {
  try { return existsSync(botIdsFile) ? JSON.parse(readFileSync(botIdsFile, 'utf8')) : {}; }
  catch { return {}; }
};
