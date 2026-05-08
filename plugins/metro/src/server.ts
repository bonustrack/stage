#!/usr/bin/env bun
// Metro plugin entry: stdio MCP server that polls Telegram and forwards
// inbound messages into the live Claude Code session as channel events.
//
// Spawned by Claude Code via `.claude-plugin/plugin.json` when the user runs
//   claude --dangerously-load-development-channels plugin:metro@metro
//
// Config (loaded from ~/.claude/channels/metro/.env, then ../.env as fallback):
//   TELEGRAM_BOT_TOKEN  bot token from @BotFather
//   TELEGRAM_CHAT_ID    numeric chat id of the bot owner (default reply target)
//   OPENAI_API_KEY      optional; required for voice/audio transcription

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

// Load env before importing modules that read process.env at module load.
loadEnvFile(join(process.env.METRO_CHANNEL_HOME || join(homedir(), ".claude", "channels", "metro"), ".env"));
loadEnvFile(fileURLToPath(new URL("../.env", import.meta.url)));

const { getMe, onInbound, startPolling } = await import("./telegram.js");
const { buildServer } = await import("./mcp.js");
const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");

const me = await getMe();
console.error(`metro: bot @${me.username} ready`);

const server = buildServer().server;

onInbound(msg => {
  void server
    .notification({
      method: "notifications/claude/channel",
      params: {
        content: msg.text,
        meta: { chat_id: String(msg.chat_id), message_id: String(msg.message_id) },
      },
    })
    .catch(() => {});
});

await server.connect(new StdioServerTransport());
void startPolling();

// Exit when Claude Code closes our stdin so we don't linger and fight for
// Telegram's single-poller slot.
process.stdin.on("end", () => process.exit(0));
process.stdin.on("close", () => process.exit(0));
