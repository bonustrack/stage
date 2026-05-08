#!/usr/bin/env bun
// Metro plugin entry. Stdio MCP server that connects to Telegram and/or
// Discord and pushes inbound messages into the live Claude Code session.
// Spawned by `claude --channels plugin:metro@metro`.

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { configuredPlatforms, loadMetroEnv, requireConfiguredPlatform, startPlatforms } from "./config.js";
import { buildServer } from "./mcp.js";

loadMetroEnv();
const platforms = configuredPlatforms();
requireConfiguredPlatform(platforms);

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

await startPlatforms(platforms, {
  telegram: m => emit("telegram", String(m.chat_id), String(m.message_id), m.text),
  discord: m => emit("discord", m.channel_id, m.message_id, m.text),
});

// Exit on stdin close so we don't linger and fight for the Telegram poller slot.
process.stdin.on("end", () => process.exit(0));
process.stdin.on("close", () => process.exit(0));
