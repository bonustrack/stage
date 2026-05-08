#!/usr/bin/env bun
// Metro plugin entry: stdio MCP server that polls Telegram and/or connects
// to Discord, forwarding inbound messages into the live Claude Code session
// as channel events.
//
// Spawned by Claude Code via `.claude-plugin/plugin.json` when the user runs
//   claude --dangerously-load-development-channels plugin:metro@metro
//
// Config (loaded from ~/.claude/channels/metro/.env):
//   TELEGRAM_BOT_TOKEN  bot token from @BotFather
//   TELEGRAM_CHAT_ID    numeric chat id of the bot owner (default reply target)
//   DISCORD_BOT_TOKEN   bot token from the Discord Developer Portal
//   DISCORD_CHANNEL_ID  snowflake of the default Discord channel (optional)
//   OPENAI_API_KEY      optional; required for Telegram voice/audio transcription
//
// At least one of TELEGRAM_BOT_TOKEN or DISCORD_BOT_TOKEN must be set.

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || m[1].startsWith("#")) continue;
    const value = m[2].replace(/^(['"])(.*)\1$/, "$2");
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}

// Load env before importing modules.
loadEnvFile(join(process.env.METRO_CHANNEL_HOME || join(homedir(), ".claude", "channels", "metro"), ".env"));
loadEnvFile(fileURLToPath(new URL("../.env", import.meta.url)));

const platforms = {
  telegram: !!process.env.TELEGRAM_BOT_TOKEN,
  discord: !!process.env.DISCORD_BOT_TOKEN,
};
if (!platforms.telegram && !platforms.discord) {
  console.error("metro: configure TELEGRAM_BOT_TOKEN and/or DISCORD_BOT_TOKEN in ~/.claude/channels/metro/.env");
  process.exit(1);
}

const { buildServer } = await import("./mcp.js");
const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");

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
  console.error(`metro: telegram bot @${me.username} ready`);
  tg.onInbound(m => emit("telegram", String(m.chat_id), String(m.message_id), m.text));
  void tg.startPolling();
}

if (platforms.discord) {
  const dc = await import("./discord.js");
  await dc.startGateway();
  const me = await dc.getMe();
  console.error(`metro: discord bot ${me.username} ready`);
  dc.onInbound(m => emit("discord", m.channel_id, m.message_id, m.text));
}

// Exit when Claude Code closes our stdin so we don't linger and fight for
// platform poller/gateway slots.
process.stdin.on("end", () => process.exit(0));
process.stdin.on("close", () => process.exit(0));
