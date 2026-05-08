#!/usr/bin/env bun
// Metro plugin entry. Stdio MCP server that connects to Telegram and/or
// Discord and pushes inbound messages into the live agent session.
//
// Runtime is selected by the METRO_RUNTIME env var (set in the plugin
// manifest):
//   - "claude-code" (default): emits MCP `notifications/claude/channel`
//     directly over the stdio pipe — Claude Code surfaces these as
//     <channel> tags in-session.
//   - "codex": opens a parallel WebSocket to the Codex app-server (URL in
//     METRO_CODEX_APP_SERVER_URL) and injects each inbound message as a new
//     turn via `turn/start`. Codex's MCP client doesn't surface stdio
//     notifications, so push has to go through that side channel.

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { startCodexDelivery, type CodexInboundMessage } from "./codex-app.js";
import { configuredPlatforms, loadMetroEnv, requireConfiguredPlatform, startPlatforms } from "./config.js";
import { buildServer } from "./mcp.js";

loadMetroEnv();
const platforms = configuredPlatforms();
requireConfiguredPlatform(platforms);

const server = buildServer(platforms).server;
await server.connect(new StdioServerTransport());

const runtime = process.env.METRO_RUNTIME ?? "claude-code";
const emit: (m: CodexInboundMessage) => void =
  runtime === "codex"
    ? startCodexDelivery()
    : claudeCodeEmit;

function claudeCodeEmit(message: CodexInboundMessage): void {
  const meta =
    message.platform === "telegram"
      ? { platform: "telegram", chat_id: message.chatId, message_id: message.messageId }
      : { platform: "discord", channel_id: message.channelId, message_id: message.messageId };
  void server
    .notification({
      method: "notifications/claude/channel",
      params: { content: message.text, meta },
    })
    .catch(() => {});
}

await startPlatforms(platforms, {
  telegram: m =>
    emit({
      platform: "telegram",
      chatId: String(m.chat_id),
      messageId: String(m.message_id),
      text: m.text,
    }),
  discord: m =>
    emit({
      platform: "discord",
      channelId: m.channel_id,
      messageId: m.message_id,
      text: m.text,
    }),
});

// Exit on stdin close so we don't linger and fight for the Telegram poller slot.
process.stdin.on("end", () => process.exit(0));
process.stdin.on("close", () => process.exit(0));
