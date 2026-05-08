import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type * as Discord from "./discord.js";
import { log } from "./log.js";
import type * as Telegram from "./telegram.js";

export type Platforms = { telegram: boolean; discord: boolean };

export type InboundHandlers = {
  telegram: (m: Telegram.InboundMessage) => void;
  discord: (m: Discord.InboundMessage) => void;
};

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

// Wires the inbound handlers and starts polling/gateway connections for every
// configured platform. The `label` is appended to the readiness log line so
// callers (server.ts, codex-bridge.ts) can distinguish their roles.
export async function startPlatforms(
  platforms: Platforms,
  handlers: InboundHandlers,
  label = "ready",
): Promise<void> {
  if (platforms.telegram) {
    const tg = await import("./telegram.js");
    const me = await tg.getMe();
    log.info({ bot: `@${me.username}` }, `telegram ${label}`);
    tg.onInbound(handlers.telegram);
    void tg.startPolling();
  }

  if (platforms.discord) {
    const dc = await import("./discord.js");
    await dc.startGateway();
    const me = await dc.getMe();
    log.info({ bot: me.username }, `discord ${label}`);
    dc.onInbound(handlers.discord);
  }
}
