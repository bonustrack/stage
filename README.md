# Metro

Chat with your Claude Code or Codex agent over Telegram and Discord. Inbound messages stream into the session live; the agent reacts, types while it works, and replies — pure CLI, ~700 lines of TypeScript, no MCP, no hosted infra.

## Quickstart

```bash
npm install -g @stage-labs/metro@beta    # or: bun add -g @stage-labs/metro@beta

metro setup telegram <token>             # from https://t.me/BotFather
# and/or:
metro setup discord <token>              # from https://discord.com/developers/applications
```

> The `@beta` tag is required while Metro is in prerelease. Tokens land in `~/.config/metro/.env` (`chmod 0600`). Run `metro setup` (no args) any time to see what's configured.

> **Discord only:** in the Developer Portal → Bot tab, toggle **Message Content Intent** under Privileged Gateway Intents — without it, message bodies arrive empty. Then generate an OAuth invite with the `bot` scope (or DM the bot directly).

In your agent session, paste this:

> Run `metro` in the background and Monitor its stdout for inbound messages. Each line is `{"platform":…, "to":…, "text":…}`. For each one: echo `[<to>] <text>` so I see it, then act with `metro reply --to=<to> --text=<reply>` (or `metro react`, `metro edit`, `metro download`, `metro fetch`). Run `metro --help` for the full reference.

Now DM your bot. The agent reacts on its next decision boundary (see Caveats for latency notes).

## How it works

- **`metro`** (alias for `metro tail`) — long-running inbound stream. Polls Telegram and connects to Discord's gateway, then prints one JSON line per inbound message on stdout: `{"platform": "telegram"|"discord", "to": "<platform>:<chat>/<message_id>", "text": "…"}`. The agent watches that stdout (Bash+Monitor in Claude Code, `unified_exec` in Codex) and acts on each line at its next decision boundary.
- **`metro <reply|react|edit|download|fetch>`** — one-shot subcommands the agent invokes via Bash to act on those inbounds. They all take a single `--to=<platform>:<chat>/<message_id>` address that the agent copies verbatim from the inbound line.

While the agent is working on a reply, both platforms show a typing indicator; when it replies, the indicator stops and the auto-ack 👀 reaction is cleared on the exact message replied to.

## Commands

| Command | Purpose |
|---|---|
| `metro` (alias `metro tail`) | Long-running inbound stream. Run in the background. |
| `metro setup [telegram\|discord <token>\|clear …]` | Save / inspect / remove tokens. No args prints status. |
| `metro reply --to=<addr> --text=<t>` | Quote-reply, threading under the original. Clears 👀. |
| `metro react --to=<addr> --emoji=<e>` | Set or clear (`''`) an emoji reaction. |
| `metro edit --to=<addr> --text=<t>` | Edit a message the bot previously sent. |
| `metro download --to=<addr> [--out=<dir>]` | Pull image attachments to disk; prints absolute paths so the agent can `Read` them. |
| `metro fetch --to=<addr> [--limit=N]` | Recent-message lookback. Discord only — pass channel-only `discord:<channel_id>`. |
| `metro update` | Check npm for a newer release and upgrade in place (npm / bun / pnpm auto-detected). |
| `metro --version`, `metro --help` | Version, full reference. |

Address format: `telegram:<chat_id>/<message_id>` or `discord:<channel_id>/<message_id>` (or `discord:<channel_id>` for `fetch`). All come straight off the inbound line.

`reply` and `edit` take `--text` either as a flag or via stdin (heredoc-friendly for multi-line replies). Telegram-only options: `--parse-mode=HTML|MarkdownV2`, `--no-link-preview`, `--buttons-json='[[{"text":"x","url":"https://…"}]]'`. Voice / audio attachments surface as `[voice]` / `[audio]` text placeholders — the agent sees them but can't download.

## Config

| Variable | Default | Description |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | — | Telegram bot token. |
| `DISCORD_BOT_TOKEN` | — | Discord bot token. |
| `METRO_CONFIG_DIR` | `~/.config/metro` (or `$XDG_CONFIG_HOME/metro`) | Where `metro setup` writes `.env`. |
| `METRO_STATE_DIR` | `~/.cache/metro` | Lockfile, typing-stop signals, attachment cache, and the default `--out` for `metro download`. |
| `METRO_LOG_LEVEL` | `info` | `trace` / `debug` / `info` / `warn` / `error` / `fatal`. |

Tokens are read in precedence order: process environment → `./.env` (cwd, for repo-local dev) → `$METRO_CONFIG_DIR/.env` (written by `metro setup`). Logs go to stderr.

## Troubleshooting

```bash
metro setup                                # show what's configured
metro --help                               # full command reference
which metro                                # → e.g. ~/.bun/bin/metro

ps aux | grep metro | grep -v grep         # verify `metro` is running
rm -rf ~/.cache/metro/                     # clean stuck state — or whatever METRO_STATE_DIR points at
```

## Caveats

- **Discord Message Content Intent** is privileged — toggle it in the Developer Portal. See above.
- **Telegram single-poller.** Telegram allows one `getUpdates` consumer per bot token. If two `metro` instances start, the second-comer detects the lockfile (`$METRO_STATE_DIR/.tail-lock`) and exits cleanly. Re-run after the first exits to take over.
- **No allowlist.** Anyone who can DM your bot or @-mention it can talk to your session. Run against bots you own.
- **Mid-task latency.** New messages surface at the next agent decision boundary — sub-second on Claude Code (lots of small tool calls), longer on Codex turns. Neither runtime can interrupt an in-progress LLM generation.
- **UI visibility.** Claude Code's `Monitor` collapses stdout into a card; Codex dims tool args. Have the agent echo each inbound on its own visible line so you see what arrived without expanding cards (see the Quickstart prompt).
