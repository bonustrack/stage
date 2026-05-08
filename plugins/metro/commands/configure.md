---
description: Configure Metro's Telegram and/or Discord credentials.
allowed-tools: Bash
argument-hint: telegram <BOT_TOKEN> [CHAT_ID] | discord <BOT_TOKEN> [CHANNEL_ID]
---

Persist platform credentials to `~/.claude/channels/metro/.env` so the plugin's stdio server picks them up on next launch. At least one platform must be set; configure the other later by re-running this command with different first arg.

## Inputs

`$ARGUMENTS`:

- `telegram <BOT_TOKEN> [CHAT_ID]` → writes `TELEGRAM_BOT_TOKEN` (and optionally `TELEGRAM_CHAT_ID`).
- `discord <BOT_TOKEN> [CHANNEL_ID]` → writes `DISCORD_BOT_TOKEN` (and optionally `DISCORD_CHANNEL_ID`).

## Steps

1. Parse `$ARGUMENTS`. Reject anything other than the two forms above.

2. Read the existing env file if present, mutate only the keys for the requested platform, write back. Preserve any unrelated lines (e.g. `OPENAI_API_KEY`, the *other* platform's keys).

   ```bash
   mkdir -p ~/.claude/channels/metro
   touch ~/.claude/channels/metro/.env
   chmod 600 ~/.claude/channels/metro/.env
   ```

3. Tell the user to restart with `claude --dangerously-load-development-channels plugin:metro@metro` for the change to take effect. If they configured Discord, remind them to enable **Message Content Intent** in the Discord Developer Portal (Bot → Privileged Gateway Intents) — without it, message bodies arrive empty.
