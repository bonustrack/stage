#!/usr/bin/env bun
// Metro bridge for Codex. Owns Telegram/Discord inbound connections and injects
// messages into a live Codex thread through the Codex app-server control API.

import { closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { configuredPlatforms, loadMetroEnv, metroHome, requireConfiguredPlatform, startPlatforms } from "./config.js";
import { deliverToCodex, formatChannelMessage, type CodexInboundMessage } from "./codex-app.js";
import { log } from "./log.js";

loadMetroEnv();
const platforms = configuredPlatforms();
requireConfiguredPlatform(platforms, process.env.METRO_BRIDGE_SKIP_IF_UNCONFIGURED === "1");
const releaseLock = acquireBridgeLock();

let queue = Promise.resolve();
function enqueue(message: CodexInboundMessage): void {
  const text = formatChannelMessage(message);
  queue = queue
    .then(() => deliverWithRetry(text, message))
    .catch(err => log.error({ err: err?.message ?? err }, "codex delivery failed"));
}

async function deliverWithRetry(text: string, message: CodexInboundMessage): Promise<void> {
  const attempts = Number(process.env.METRO_CODEX_DELIVERY_ATTEMPTS ?? 90);
  const delayMs = Number(process.env.METRO_CODEX_DELIVERY_RETRY_MS ?? 2_000);
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await deliverToCodex(text);
      log.info({ platform: message.platform, messageId: message.messageId }, "delivered inbound message to codex");
      return;
    } catch (err) {
      lastError = err;
      if (attempt === attempts) break;
      log.warn(
        { err: err instanceof Error ? err.message : String(err), attempt, attempts },
        "codex delivery failed; retrying",
      );
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

await startPlatforms(
  platforms,
  {
    telegram: m =>
      enqueue({
        platform: "telegram",
        chatId: String(m.chat_id),
        messageId: String(m.message_id),
        text: m.text,
      }),
    discord: m =>
      enqueue({
        platform: "discord",
        channelId: m.channel_id,
        messageId: m.message_id,
        text: m.text,
      }),
  },
  "bridge ready",
);

process.on("SIGINT", () => {
  releaseLock();
  process.exit(0);
});
process.on("SIGTERM", () => {
  releaseLock();
  process.exit(0);
});
process.on("exit", releaseLock);

function acquireBridgeLock(): () => void {
  if (process.env.METRO_CODEX_BRIDGE_LOCK === "0") return () => {};

  mkdirSync(metroHome(), { recursive: true });
  const lockPath = join(metroHome(), "codex-bridge.lock");

  if (existsSync(lockPath)) {
    const pid = Number(readFileSync(lockPath, "utf8"));
    if (Number.isInteger(pid) && pid > 0 && processIsAlive(pid)) {
      log.info({ pid }, "metro codex bridge already running");
      process.exit(0);
    }
    unlinkSync(lockPath);
  }

  const fd = openSync(lockPath, "wx");
  writeFileSync(fd, String(process.pid));
  closeSync(fd);
  return () => {
    try {
      if (existsSync(lockPath) && readFileSync(lockPath, "utf8") === String(process.pid)) {
        unlinkSync(lockPath);
      }
    } catch {
      // Nothing to clean up.
    }
  };
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
