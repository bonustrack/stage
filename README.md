# Metro

Telegram + Discord channel for Claude Code. Inbound messages stream into your live session via the `--channels` flag; the agent responds with `reply` / `react` / `edit-message` per platform. One local stdio MCP, no hosted infra. Configure either platform, both, or one without the other.

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

## Tools

Tools are namespaced per platform; only the families you've configured get registered.

| Platform | Tools |
|---|---|
| Telegram | `telegram-reply`, `telegram-react`, `telegram-edit-message`, `telegram-download-attachment` |
| Discord  | `discord-reply`, `discord-react`, `discord-edit-message`, `discord-download-attachment`, `discord-fetch-messages` |

Each `<channel>` notification carries a `platform` attribute so the agent picks the right family.

`*-download-attachment` returns image content blocks for image attachments. Telegram caches `file_id`s in memory, so a plugin restart drops them; Discord works on any reachable message. Voice/audio messages surface as `[voice]` / `[audio]` placeholders — Claude Code can't yet ingest MCP audio content blocks. `discord-fetch-messages` is Discord-only since Discord exposes no search API for bots.

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

## Caveats

- **Discord Message Content Intent** required (privileged) — see install gotcha above.
- **Telegram single-poller.** Two Claude Code sessions on the same TG token will fight for the `getUpdates` slot; Discord allows multiple gateway connections.
- **No pairing/allowlist.** For Telegram, anyone with the bot's `@username` can DM your session. For Discord, the bot only forwards DMs and `@mention` messages — but anyone in those channels can talk to your session. Run against bots you own.
