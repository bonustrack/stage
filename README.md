# Metro

Telegram + Discord channel for Claude Code, mirroring the design of Anthropic's official Discord and Telegram plugins. Inbound messages stream into your live session via the `--channels` flag; the agent responds with `reply` / `react` / `edit-message` tools per platform. One local stdio MCP, no hosted infra. Configure either platform, both, or one without the other.

## Install

```bash
# 1. Add this repo as a marketplace.
/plugin marketplace add bonustrack/metro

# 2. Install the plugin.
/plugin install metro@metro

# 3. Configure at least one platform.
/metro:configure telegram <TELEGRAM_BOT_TOKEN>     # from @BotFather
# and/or
/metro:configure discord  <DISCORD_BOT_TOKEN>      # from discord.com/developers/applications

# 4. Restart with the channel enabled.
exit
claude --dangerously-load-development-channels plugin:metro@metro

# 5. DM either bot. The notification carries `chat_id` (TG) or `channel_id` (DC) —
# pass it back in the next configure call to set a default reply target:
/metro:configure telegram <TOKEN> <CHAT_ID>
/metro:configure discord  <TOKEN> <CHANNEL_ID>
```

**Discord setup gotcha.** In the Discord Developer Portal, under **Bot → Privileged Gateway Intents**, enable **Message Content Intent**. Without it, `messageCreate` events arrive with empty `content` and the bot will see nothing.

## Tools

Tools are namespaced per platform; only the families you've configured get registered.

| Platform | Tools |
|---|---|
| Telegram | `telegram-reply`, `telegram-react`, `telegram-edit-message`, `telegram-download-attachment` |
| Discord  | `discord-reply`, `discord-react`, `discord-edit-message`, `discord-download-attachment`, `discord-fetch-messages` |

Each `<channel>` notification carries a `platform` attribute so the agent picks the right family.

`*-download-attachment` lets the agent see images the user sent. Telegram caches `file_id`s in memory only, so a plugin restart drops them. Voice notes / audio messages surface as `[voice]` / `[audio]` placeholders — Claude Code can't yet ingest MCP audio content blocks, and we don't ship a transcription service. `discord-fetch-messages` is Discord-only, since Discord exposes no search API for bots.

## Slash commands

- `/metro:configure telegram <TOKEN> [CHAT_ID]`
- `/metro:configure discord <TOKEN> [CHANNEL_ID]`
- `/metro:status` — show configured platforms, mask tokens, verify reachability.

## Config

Plugin reads `~/.claude/channels/metro/.env`:

```
# Telegram
TELEGRAM_BOT_TOKEN=123456:ABC…
TELEGRAM_CHAT_ID=987654321

# Discord
DISCORD_BOT_TOKEN=MTIz…
DISCORD_CHANNEL_ID=11223344…
```

## Architecture

```
Telegram ─poll(getUpdates)──┐
                            ├─▶  src/server.ts  ─stdio MCP─▶  Claude Code
Discord  ─gateway WS────────┘         │
                                      ▼
                          notifications/claude/channel
                          (rendered in-session as <channel platform="..."> tags)
```

Single process. Each platform is started only if its token is set; both run in the same MCP server, sharing the notification dispatcher.

## Caveats

- **Discord Message Content Intent.** Required and privileged — see install gotcha above.
- **Telegram single-poller.** Telegram allows only one `getUpdates` poller per token at a time. Two Claude Code sessions on the same TG token will fight; Discord is fine because the gateway accepts multiple connections.
- **Pairing not implemented.** v0.5 has no allowlist on either platform. For Telegram, anyone with the bot's `@username` can DM it. For Discord, the bot only forwards DMs and guild messages where it's @mentioned — but anyone in those contexts can talk to your session. Run against bots you own and don't share publicly.
