import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { log } from "./log.js";

export type Platforms = { telegram: boolean; discord: boolean };

export function metroHome(): string {
  return process.env.METRO_CHANNEL_HOME ?? join(homedir(), ".claude", "channels", "metro");
}

export function loadMetroEnv(): string {
  const envFile = join(metroHome(), ".env");
  if (!existsSync(envFile)) return envFile;

  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || m[1].startsWith("#")) continue;
    if (process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
    }
  }

  return envFile;
}

export function configuredPlatforms(): Platforms {
  return {
    telegram: !!process.env.TELEGRAM_BOT_TOKEN,
    discord: !!process.env.DISCORD_BOT_TOKEN,
  };
}

export function requireConfiguredPlatform(platforms: Platforms, skipIfMissing = false): void {
  if (platforms.telegram || platforms.discord) return;

  const message = `configure TELEGRAM_BOT_TOKEN and/or DISCORD_BOT_TOKEN in ${join(metroHome(), ".env")}`;
  if (skipIfMissing) {
    log.info(message);
    process.exit(0);
  }

  log.fatal(message);
  process.exit(1);
}
