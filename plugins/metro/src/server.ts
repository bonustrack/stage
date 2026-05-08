#!/usr/bin/env bun
// Metro outbound MCP server. Registered with `claude mcp add` or `codex mcp
// add`; exposes the reply / react / edit-message / download-attachment /
// fetch-messages tools. Inbound is a separate process (src/tail.ts) that
// the agent runs in the background.

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { configuredPlatforms, loadMetroEnv, requireConfiguredPlatform } from "./config.js";
import { buildServer } from "./mcp.js";

loadMetroEnv();
const platforms = configuredPlatforms();
requireConfiguredPlatform(platforms);

// Discord tools need a logged-in client to make REST calls; pre-warm the gateway.
if (platforms.discord) {
  const dc = await import("./discord.js");
  await dc.startGateway();
}

const server = buildServer(platforms).server;
await server.connect(new StdioServerTransport());

process.stdin.on("end", () => process.exit(0));
process.stdin.on("close", () => process.exit(0));
