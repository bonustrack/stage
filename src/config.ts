import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { log } from './log.js';

export type Platforms = { telegram: boolean; discord: boolean };

// Repo root — where .env, package.json, and runtime state files live.
export const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));

export function loadMetroEnv(): void {
  const envFile = join(REPO_ROOT, '.env');
  if (!existsSync(envFile)) return;
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || m[1].startsWith('#')) continue;
    if (process.env[m[1]] === undefined) {
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
  log.fatal(`configure TELEGRAM_BOT_TOKEN and/or DISCORD_BOT_TOKEN in ${join(REPO_ROOT, '.env')}`);
  process.exit(1);
}
