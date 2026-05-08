---
description: Show the Metro plugin's current configuration and bot status.
allowed-tools: Bash
---

Report on the plugin's local config and verify the configured bot token actually works against Telegram's API.

## Steps

1. Read `~/.claude/channels/metro/.env` (don't print the raw token; mask all but the last 6 chars).

2. If `TELEGRAM_BOT_TOKEN` is set, hit `https://api.telegram.org/bot<TOKEN>/getMe` and report the bot's `@username` and `id`.

3. Report whether `TELEGRAM_CHAT_ID` and `OPENAI_API_KEY` are set (don't print values).

4. If anything is missing, point at `/metro:configure`.
