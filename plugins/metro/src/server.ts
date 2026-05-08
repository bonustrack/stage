#!/usr/bin/env bun
// Metro plugin entry. Stdio MCP server that connects to Telegram and/or
// Discord and pushes inbound messages into the live Claude Code session.
// Spawned by `claude --channels plugin:metro@metro`.

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

function loadEnv(path: string): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || m[1].startsWith("#")) continue;
    if (process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
    }
  }
}

// Channel home first, then a repo-local .env for development.
const CHANNEL_HOME = process.env.METRO_CHANNEL_HOME ?? join(homedir(), ".claude", "channels", "metro");
loadEnv(join(CHANNEL_HOME, ".env"));
loadEnv(fileURLToPath(new URL("../.env", import.meta.url)));

const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");
const { log } = await import("./log.js");
const { buildServer } = await import("./mcp.js");

const platforms = {
  telegram: !!process.env.TELEGRAM_BOT_TOKEN,
  discord: !!process.env.DISCORD_BOT_TOKEN,
};
if (!platforms.telegram && !platforms.discord) {
  log.fatal("configure TELEGRAM_BOT_TOKEN and/or DISCORD_BOT_TOKEN in ~/.claude/channels/metro/.env");
  process.exit(1);
}

const server = buildServer(platforms).server;
await server.connect(new StdioServerTransport());

function emit(platform: "telegram" | "discord", chat_id: string, message_id: string, text: string): void {
  void server
    .notification({
      method: "notifications/claude/channel",
      params: { content: text, meta: { platform, chat_id, message_id } },
    })
    .catch(() => {});
}

if (platforms.telegram) {
  const tg = await import("./telegram.js");
  const me = await tg.getMe();
  log.info({ bot: `@${me.username}` }, "telegram ready");
  tg.onInbound(m => emit("telegram", String(m.chat_id), String(m.message_id), m.text));
  void tg.startPolling();
}

if (platforms.discord) {
  const dc = await import("./discord.js");
  await dc.startGateway();
  const me = await dc.getMe();
  log.info({ bot: me.username }, "discord ready");
  dc.onInbound(m => emit("discord", m.channel_id, m.message_id, m.text));
}

// Exit on stdin close so we don't linger and fight for the Telegram poller slot.
process.stdin.on("end", () => process.exit(0));
process.stdin.on("close", () => process.exit(0));
