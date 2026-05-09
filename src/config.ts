import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { log } from './log.js';

export type Platforms = { telegram: boolean; discord: boolean };

// Lockfiles, typing-stop signals, and the attachment cache live here.
// Override with METRO_STATE_DIR.
export const STATE_DIR = process.env.METRO_STATE_DIR ?? join(homedir(), '.cache', 'metro');
mkdirSync(STATE_DIR, { recursive: true });

// Optional .env in cwd — convenience for local development. In production,
// env vars come from the MCP server's `env` block.
export function loadMetroEnv(): void {
  const envFile = join(process.cwd(), '.env');
  if (!existsSync(envFile)) return;
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_]\w*)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  }
}

export function configuredPlatforms(): Platforms {
  return {
    telegram: !!process.env.TELEGRAM_BOT_TOKEN,
    discord: !!process.env.DISCORD_BOT_TOKEN,
  };
}

export function requireConfiguredPlatform(p: Platforms): void {
  if (p.telegram || p.discord) return;
  log.fatal('set TELEGRAM_BOT_TOKEN and/or DISCORD_BOT_TOKEN — pass via the MCP server `env` block, or in ./.env for local dev');
  process.exit(1);
}
