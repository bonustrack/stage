import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { log } from './log.js';

export type Platforms = { telegram: boolean; discord: boolean };

// Lockfiles, typing-stop signals, and the attachment cache live here.
// Override with METRO_STATE_DIR.
export const STATE_DIR = process.env.METRO_STATE_DIR ?? join(homedir(), '.cache', 'metro');
mkdirSync(STATE_DIR, { recursive: true });

// Where `metro setup` writes the global .env. Override with METRO_CONFIG_DIR
// or the standard $XDG_CONFIG_HOME.
export const CONFIG_DIR =
  process.env.METRO_CONFIG_DIR ??
  join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'metro');
export const CONFIG_ENV_FILE = join(CONFIG_DIR, '.env');

function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_]\w*)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  }
}

// Precedence: process.env (already set) > cwd/.env > <CONFIG_DIR>/.env.
// `loadEnvFile` only sets vars that aren't already populated, so the first
// call that defines a key wins.
export function loadMetroEnv(): void {
  loadEnvFile(join(process.cwd(), '.env'));
  loadEnvFile(CONFIG_ENV_FILE);
}

export function configuredPlatforms(): Platforms {
  return {
    telegram: !!process.env.TELEGRAM_BOT_TOKEN,
    discord: !!process.env.DISCORD_BOT_TOKEN,
  };
}

export function requireConfiguredPlatform(p: Platforms): void {
  if (p.telegram || p.discord) return;
  log.fatal('set TELEGRAM_BOT_TOKEN and/or DISCORD_BOT_TOKEN in the environment, or in ./.env for local dev');
  process.exit(1);
}
