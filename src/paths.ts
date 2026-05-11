import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { loadDotenvIntoProcess } from './lib/dotenv.js';
import { log } from './log.js';

export type Platforms = { telegram: boolean; discord: boolean };

// Lockfile, scope cache, codex app-server socket, telegram poll offset,
// claude session set. Override with METRO_STATE_DIR.
export const STATE_DIR = process.env.METRO_STATE_DIR ?? join(homedir(), '.cache', 'metro');
mkdirSync(STATE_DIR, { recursive: true });

// Where `metro setup` writes the global .env. Override with METRO_CONFIG_DIR
// or the standard $XDG_CONFIG_HOME.
const CONFIG_DIR =
  process.env.METRO_CONFIG_DIR ??
  join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'metro');
export const CONFIG_ENV_FILE = join(CONFIG_DIR, '.env');

// Precedence: process.env (already set) > cwd/.env > <CONFIG_DIR>/.env.
// loadDotenvIntoProcess only fills vars that aren't already populated, so the
// first call that defines a key wins.
export function loadMetroEnv(): void {
  loadDotenvIntoProcess(join(process.cwd(), '.env'));
  loadDotenvIntoProcess(CONFIG_ENV_FILE);
}

export function configuredPlatforms(): Platforms {
  return {
    telegram: !!process.env.TELEGRAM_BOT_TOKEN,
    discord: !!process.env.DISCORD_BOT_TOKEN,
  };
}

export function requireConfiguredPlatform(p: Platforms): void {
  if (p.telegram || p.discord) return;
  log.fatal('no platforms configured — run `metro setup telegram <token>` or `metro setup discord <token>`');
  process.exit(2);
}
