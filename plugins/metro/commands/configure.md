---
description: Configure Metro's Telegram and/or Discord bot tokens.
allowed-tools: Bash
argument-hint: telegram <BOT_TOKEN> | discord <BOT_TOKEN>
---

Persist a platform's bot token to `~/.claude/channels/metro/.env` so the plugin's stdio server picks it up on next launch. At least one platform must be set; configure the other later by re-running with a different first arg.

## Inputs

`$ARGUMENTS`:

- `telegram <BOT_TOKEN>` → writes `TELEGRAM_BOT_TOKEN`.
- `discord <BOT_TOKEN>` → writes `DISCORD_BOT_TOKEN`.

## Steps

1. Parse `$ARGUMENTS`. Reject anything other than the two forms above.

2. Read the existing env file if present, mutate only the requested platform's token, write back. Preserve any unrelated lines (e.g. the *other* platform's token).

   ```bash
   mkdir -p ~/.claude/channels/metro
   touch ~/.claude/channels/metro/.env
   chmod 600 ~/.claude/channels/metro/.env
   ```

3. Tell the user to restart with `claude --dangerously-load-development-channels plugin:metro@metro` for the change to take effect. If they configured Discord, remind them to enable **Message Content Intent** in the Discord Developer Portal (Bot → Privileged Gateway Intents) — without it, message bodies arrive empty.
