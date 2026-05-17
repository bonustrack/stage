import { chmodSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { log } from './log.js';

export const STATE_DIR = process.env.METRO_STATE_DIR ?? join(homedir(), '.cache', 'metro');
mkdirSync(STATE_DIR, { recursive: true });

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

export function writeDotenv(path: string, env: Record<string, string>): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n') + '\n');
  chmodSync(path, 0o600);
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

/** Singleton pidfile. Exits if another instance owns it; reclaims stale locks. */
export function acquireLock(lockFile: string): void {
  if (existsSync(lockFile)) {
    const pid = Number(readFileSync(lockFile, 'utf8').trim());
    try {
      if (Number.isInteger(pid) && pid > 0) { process.kill(pid, 0); log.info({ pid }, 'another `metro` is running; exiting'); process.exit(0); }
    } catch { /* stale */ }
    try { unlinkSync(lockFile); } catch { /* ignore */ }
  }
  writeFileSync(lockFile, String(process.pid));
  process.on('exit', () => { try { if (readFileSync(lockFile, 'utf8').trim() === String(process.pid)) unlinkSync(lockFile); } catch { /* ignore */ } });
}
