---
description: Show Metro's current configuration and verify each configured platform.
allowed-tools: Bash
---

Report on the plugin's local config and verify any configured tokens actually work against their platform's API.

## Steps

1. Read `~/.claude/channels/metro/.env`. Mask all but the last 6 chars of any token.

2. If `TELEGRAM_BOT_TOKEN` is set, hit `https://api.telegram.org/bot<TOKEN>/getMe` and report the bot's `@username`.

3. If `DISCORD_BOT_TOKEN` is set, hit `https://discord.com/api/v10/users/@me` with header `Authorization: Bot <TOKEN>` and report the bot's `username`.

4. Report whether `TELEGRAM_CHAT_ID`, `DISCORD_CHANNEL_ID`, and `OPENAI_API_KEY` are set (don't print values).

5. If neither platform is configured, point at `/metro:configure`.
