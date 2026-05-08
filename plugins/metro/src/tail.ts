#!/usr/bin/env bun
// Standalone inbound stream. Polls Telegram + connects to Discord, prints
// one JSON line per inbound message on stdout. Designed to be launched by
// an agent and observed via Claude Code's `Bash run_in_background=true` +
// `Monitor`, or Codex's `unified_exec` + `write_stdin` polling.
//
// Each line shape:
//   {"platform":"telegram","chat_id":"…","message_id":42,"text":"…"}
//   {"platform":"discord","channel_id":"…","message_id":"…","text":"…"}
//
// stderr carries pino-formatted operational logs; stdout is reserved for
// JSON inbound messages so observers can parse it as JSONL.

import { configuredPlatforms, loadMetroEnv, requireConfiguredPlatform, startPlatforms } from "./config.js";

loadMetroEnv();
const platforms = configuredPlatforms();
requireConfiguredPlatform(platforms);

function emit(line: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify(line)}\n`);
}

await startPlatforms(platforms, {
  telegram: m => emit({ platform: "telegram", chat_id: String(m.chat_id), message_id: m.message_id, text: m.text }),
  discord: m => emit({ platform: "discord", channel_id: m.channel_id, message_id: m.message_id, text: m.text }),
});

process.stdin.on("end", () => process.exit(0));
process.stdin.on("close", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
