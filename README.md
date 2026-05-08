# Metro

Telegram + Discord channel for Claude Code and Codex. In Claude Code, inbound messages stream into your live session via the `--channels` flag. In Codex, a local bridge injects inbound messages into a shared app-server session. The agent responds with `reply` / `react` / `edit-message` per platform. One local stdio MCP, no hosted infra. Configure either platform, both, or one without the other.

## Install

```bash
# Add this repo as a marketplace, then install the plugin.
/plugin marketplace add bonustrack/metro
/plugin install metro@metro

# Configure at least one platform.
/metro:configure telegram <TELEGRAM_BOT_TOKEN>     # from @BotFather
/metro:configure discord  <DISCORD_BOT_TOKEN>      # from discord.com/developers/applications

# Restart with the channel enabled.
exit
claude --dangerously-load-development-channels plugin:metro@metro
```

DM either bot. The notification carries `chat_id` (TG) or `channel_id` (DC) in the `<channel>` tag — the agent reads them straight off the inbound message and threads them through `reply` / `react` / `edit-message` automatically.

**Discord setup gotcha.** In the Discord Developer Portal, under **Bot → Privileged Gateway Intents**, enable **Message Content Intent**. Without it `messageCreate` events arrive with empty `content`.

## Codex

Metro runs as a single MCP server in both runtimes. The same `server.ts`
script handles tool calls and pushes inbound messages — for Claude Code via
MCP `notifications/claude/channel`, for Codex via a parallel WebSocket to
the Codex app-server (Codex doesn't surface stdio MCP notifications).

Codex uses the same config file as Claude Code:

```
~/.claude/channels/metro/.env
```

Override with `METRO_CHANNEL_HOME=/path/to/metro-config`.

For live delivery you need a running app-server attached to the visible Codex
UI:

```bash
# Terminal 1: shared Codex app-server.
codex app-server --listen ws://127.0.0.1:17633

# Terminal 2: visible Codex UI attached to that app-server.
codex --remote ws://127.0.0.1:17633 -C /path/to/metro
```

Register the MCP server with Codex:

```bash
codex mcp add metro \
  --env METRO_RUNTIME=codex \
  --env METRO_CODEX_APP_SERVER_URL=ws://127.0.0.1:17633 \
  -- bun run --cwd /path/to/metro/plugins/metro --silent start
```

`METRO_RUNTIME=codex` flips the push path from MCP notifications to
app-server `turn/start`. If multiple Codex threads are loaded, set
`METRO_CODEX_THREAD_ID=<thread-id>` to disambiguate.

## Tools

Tools are namespaced per platform; only the families you've configured get registered.

| Platform | Tools |
|---|---|
| Telegram | `telegram-reply`, `telegram-react`, `telegram-edit-message`, `telegram-download-attachment` |
| Discord  | `discord-reply`, `discord-react`, `discord-edit-message`, `discord-download-attachment`, `discord-fetch-messages` |

Each `<channel>` notification carries a `platform` attribute so the agent picks the right family.

`*-download-attachment` returns image content blocks for image attachments. Telegram persists recent `file_id`s in `~/.claude/channels/metro/telegram-attachments.json` so they survive a plugin restart; Discord works on any reachable message. Voice/audio messages surface as `[voice]` / `[audio]` placeholders — Claude Code can't yet ingest MCP audio content blocks. `discord-fetch-messages` is Discord-only since Discord exposes no search API for bots.

## Slash commands

- `/metro:configure telegram <TOKEN>`
- `/metro:configure discord <TOKEN>`
- `/metro:status` — show configured platforms, mask tokens, verify reachability.

## Config

Plugin reads `~/.claude/channels/metro/.env`:

```
TELEGRAM_BOT_TOKEN=123456:ABC…
DISCORD_BOT_TOKEN=MTIz…
```

`METRO_LOG_LEVEL` (trace|debug|info|warn|error|fatal) controls plugin log verbosity; default `info`. Logs go to stderr (Claude Code captures them in `~/Library/Caches/claude-cli-nodejs/.../mcp-logs-plugin-metro-metro/*.jsonl`).

## Architecture

```
Telegram ─poll(getUpdates)──┐
                            ├─▶  src/server.ts  ─stdio MCP─▶  Claude Code
Discord  ─gateway WS────────┘         │
                                      ▼
                          notifications/claude/channel
                          (rendered in-session as <channel platform="..."> tags)
```

Each platform is started only if its token is set; both run in the same MCP server, sharing the notification dispatcher.

In Codex mode the same `server.ts` opens a side-channel WebSocket to the Codex
app-server and uses `turn/start` for inbound delivery (Codex drops stdio MCP
notifications, so the side-channel is required):

```
Telegram / Discord ─▶ src/server.ts ┬─ stdio MCP ─▶ tool calls
                                    └─ ws app-server (turn/start) ─▶ live Codex thread
```

Polling lives only while the agent session is open — no detached daemon, no
lockfile.

## Caveats

- **Discord Message Content Intent** required (privileged) — see install gotcha above.
- **Telegram single-poller.** Two Metro runtimes on the same Telegram token will fight for the `getUpdates` slot; Discord allows multiple gateway connections.
- **No pairing/allowlist.** For Telegram, anyone with the bot's `@username` can DM your session. For Discord, the bot only forwards DMs and `@mention` messages — but anyone in those channels can talk to your session. Run against bots you own.
