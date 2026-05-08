# Metro

Telegram channel for Claude Code, mirroring the design of Anthropic's official Discord and Telegram plugins. Inbound messages stream into your live session via the `--channels` flag; the agent responds with `reply` / `react` / `edit-message`. One local stdio MCP, no hosted infra.

## Install

```bash
# 1. Add this repo as a marketplace (clones it locally on first install).
/plugin marketplace add bonustrack/metro

# 2. Install the plugin.
/plugin install metro@metro

# 3. Create a bot via @BotFather on Telegram, copy its token.
# 4. Configure the plugin (replace the placeholders):
/metro:configure <BOT_TOKEN>

# 5. Restart with the channel enabled.
exit
claude --dangerously-load-development-channels plugin:metro@metro

# 6. DM your bot once. The plugin logs `chat_id` to stderr; pass it back:
/metro:configure <BOT_TOKEN> <CHAT_ID>
exit
claude --dangerously-load-development-channels plugin:metro@metro
```

After the second restart, every message you send the bot appears in the live session. The agent replies via the `reply` tool, threading under your message.

## Tools

| Tool | Purpose |
|---|---|
| `reply` | Quote-reply to a specific Telegram `message_id`. Supports HTML / MarkdownV2 / URL buttons. |
| `react` | Set or clear an emoji reaction (Telegram's whitelisted set). |
| `edit-message` | Edit a message the bot previously sent. |

There is no `notify`/`ask`. The channel model assumes the user initiates and the agent reacts.

## Slash commands

- `/metro:configure <BOT_TOKEN> [CHAT_ID]` — write credentials to `~/.claude/channels/metro/.env`.
- `/metro:status` — show the configured bot, mask the token, verify reachability.

## Config

Plugin reads `~/.claude/channels/metro/.env`:

```
TELEGRAM_BOT_TOKEN=123456:ABC…
TELEGRAM_CHAT_ID=987654321
OPENAI_API_KEY=sk-…           # optional, enables voice/audio transcription
```

## Architecture

```
Telegram  ─poll(getUpdates)─▶  src/server.ts  ─stdio MCP─▶  Claude Code
                                   │
                                   ▼
                          notifications/claude/channel
                          (rendered in-session as <channel> tags)
```

Single process. The bot token is local; there is no hosted server, no OAuth, no SSE bridge.

## Caveats

- **Single-poller.** Telegram allows only one `getUpdates` poller per token at a time. If two Claude Code sessions enable `--channels plugin:metro@metro` simultaneously, they will fight over the slot. Use one session per bot, or mint a separate bot for each session.
- **Pairing not implemented.** v0.3 has no allowlist; whoever has the bot's `@username` can DM it and their messages will appear in your session. For sensitive setups, keep the bot username private or run the plugin against a bot scoped to a private group.
