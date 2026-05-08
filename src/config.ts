import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { log } from "./log.js";

export type Platforms = { telegram: boolean; discord: boolean };

export function metroHome(): string {
  return process.env.METRO_CHANNEL_HOME ?? join(homedir(), ".claude", "channels", "metro");
}

// Canonical home, then a repo-root .env for development. First reader wins.
export function loadMetroEnv(): void {
  for (const path of [
    join(metroHome(), ".env"),
    fileURLToPath(new URL("../.env", import.meta.url)),
  ]) {
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!m || m[1].startsWith("#")) continue;
      if (process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
      }
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
  log.fatal(`configure TELEGRAM_BOT_TOKEN and/or DISCORD_BOT_TOKEN in ${join(metroHome(), ".env")}`);
  process.exit(1);
}
