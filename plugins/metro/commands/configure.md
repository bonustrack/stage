---
description: Configure the Metro plugin's Telegram bot token and chat id.
allowed-tools: Bash
argument-hint: <BOT_TOKEN> [CHAT_ID]
---

Persist the user's Telegram credentials to `~/.claude/channels/metro/.env` so the plugin's stdio server picks them up on next launch.

## Inputs

`$ARGUMENTS` — first the bot token from @BotFather, then optionally the chat id of the bot owner.

If chat id is missing, ask the user to DM the bot once after restarting; on first message the bot logs its `chat_id` to stderr (visible in Claude Code's status pane), and they can re-run `/metro:configure` with both args.

## Steps

1. Parse `$ARGUMENTS`. Validate the token shape (`<digits>:<base64-ish>`).

2. Write the env file (creating the directory if missing). Preserve any existing `OPENAI_API_KEY` line if the file already exists.

   ```bash
   mkdir -p ~/.claude/channels/metro
   touch ~/.claude/channels/metro/.env
   chmod 600 ~/.claude/channels/metro/.env
   # then write TELEGRAM_BOT_TOKEN=… and (if provided) TELEGRAM_CHAT_ID=…
   ```

3. Tell the user to restart with `claude --dangerously-load-development-channels plugin:metro@metro` for the change to take effect.
