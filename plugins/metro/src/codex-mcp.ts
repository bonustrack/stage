#!/usr/bin/env bun
// Codex MCP tool server. It exposes Metro reply/react/edit/download tools but
// does not poll Telegram; inbound delivery is handled by codex-bridge.ts.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { configuredPlatforms, loadMetroEnv, requireConfiguredPlatform } from "./config.js";
import { log } from "./log.js";
import { buildServer } from "./mcp.js";

loadMetroEnv();
const platforms = configuredPlatforms();
requireConfiguredPlatform(platforms);
startBridgeSidecar();

if (platforms.discord) {
  const dc = await import("./discord.js");
  await dc.startGateway();
  const me = await dc.getMe();
  log.info({ bot: me.username }, "discord tools ready");
}

const server = buildServer(platforms).server;
await server.connect(new StdioServerTransport());

process.stdin.on("end", () => process.exit(0));
process.stdin.on("close", () => process.exit(0));

function startBridgeSidecar(): void {
  if (process.env.METRO_CODEX_MCP_START_BRIDGE === "0") return;

  const child = spawn("bun", ["src/codex-bridge.ts"], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    detached: true,
    env: { ...process.env, METRO_BRIDGE_SKIP_IF_UNCONFIGURED: "1" },
    stdio: "ignore",
  });
  child.on("error", err => log.warn({ err: err.message }, "failed to start codex bridge sidecar"));
  child.unref();
  log.info({ pid: child.pid }, "started codex bridge sidecar");
}
