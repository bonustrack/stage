# Metro

Chat with your Claude Code or Codex agent over Telegram and Discord. Messages land in the session live, the agent reacts in <1s, types while it works, and replies — ~700 lines of TypeScript, one stdio MCP, no hosted infra.

```
You (Telegram) ───────────────────────────────────────────────────────
  "what's on this branch?"
  👀                                            ← Metro reacts in <1s
  Bot is typing…                                ← typing while agent works
  Bot:  "5 files changed since main:
         src/server.ts, src/tail.ts, …"
```

## Quickstart

```bash
npm install -g @stage-labs/metro@beta    # or: bun add -g @stage-labs/metro@beta
```

> The `@beta` tag is required while Metro is in prerelease.

Register Metro with your agent (use `claude` or `codex` interchangeably):

```bash
claude mcp add metro \
  --env TELEGRAM_BOT_TOKEN=123:ABC… \
  --env DISCORD_BOT_TOKEN=MTIz… \
  -- metro mcp
```

Both `--env` flags are optional — configure at least one of Telegram or Discord.

In your agent session, ask it to start the inbound stream:

> Run `metro tail` in the background and Monitor its stdout for inbound Telegram/Discord messages.

DM your bot. The agent reacts within ~1 second.

## Bot tokens

- **Telegram**: DM [@BotFather](https://t.me/BotFather), `/newbot`, copy the token.
- **Discord**: [discord.com/developers/applications](https://discord.com/developers/applications) → New Application → Bot → Reset Token. **Toggle Message Content Intent** in the same Bot tab (Privileged Gateway Intents) — without it, message bodies arrive empty. Generate an OAuth invite with the `bot` scope, or DM the bot directly.

## How it works

Metro ships two commands:

- **`metro mcp`** — a stdio MCP server. Registers the tools below so the agent can reply, react, edit, and download attachments. Started once when the agent boots (via `claude mcp add` / `codex mcp add` above).
- **`metro tail`** — the inbound runtime. Polls Telegram and connects to Discord's WebSocket gateway, then prints one JSON line per inbound message to stdout. The agent watches that stdout (Bash+Monitor in Claude Code, unified_exec in Codex) and acts on each line within ~1s. Started on demand from inside an agent session.

```
Telegram ─poll(getUpdates)──┐
                            ├─▶ metro tail ─stdout JSONL─▶ agent (Monitor / unified_exec)
Discord  ─gateway WS────────┘
                                                    │
                                                    └─▶ metro mcp (MCP) ◀─ tool calls
                                                       reply / react / edit / download / fetch
```

While the agent works on a reply, both platforms show a typing indicator; when it replies, the indicator stops and the auto-ack reaction (👀) is cleared on the exact message replied to.

## MCP tools

Registered by `metro mcp` — the agent calls these to act on the messages it sees from `metro tail`:

| Tool | Telegram | Discord | Purpose |
|---|---|---|---|
| Reply | `telegram-reply` | `discord-reply` | Quote-reply, threading under the original message. Clears the 👀 auto-ack. |
| React | `telegram-react` | `discord-react` | Set or clear an emoji reaction. |
| Edit | `telegram-edit-message` | `discord-edit-message` | Edit a message the bot previously sent. |
| Download attachment | `telegram-download-attachment` | `discord-download-attachment` | Pull image attachments back as `image` content blocks. |
| Fetch recent messages | — | `discord-fetch-messages` | Lookback for context. (Discord exposes no search API for bots; Telegram has none either.) |

The agent reads `chat_id` / `channel_id` and `message_id` from the inbound JSON and threads them through. Voice / audio surface as `[voice]` / `[audio]` text placeholders — the agent sees them but can't download.

## Config

All settings come from environment variables passed via the MCP server's `--env` block:

| Variable | Default | Description |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | — | Telegram bot token. Required for the Telegram channel. |
| `DISCORD_BOT_TOKEN` | — | Discord bot token. Required for the Discord channel. |
| `METRO_LOG_LEVEL` | `info` | `trace`/`debug`/`info`/`warn`/`error`/`fatal`. |
| `METRO_STATE_DIR` | `~/.cache/metro` | Where the lockfile, typing-stop signals, and the Telegram attachment cache live. |

Logs go to stderr. Claude Code captures them at `~/Library/Caches/claude-cli-nodejs/…/mcp-logs-plugin-metro-metro/*.jsonl`.

For local dev (cloned repo, no host agent): `cp .env.example .env && chmod 600 .env`, then run `metro tail` / `metro mcp` from the repo dir — `.env` is read as a fallback when env vars aren't set.

## Troubleshooting

```bash
which metro                                # → e.g. ~/.bun/bin/metro
metro                                      # prints usage

ps aux | grep metro | grep -v grep         # one `metro mcp`, optionally one `metro tail`

rm -rf ~/.cache/metro/                     # clean stuck state — or whatever METRO_STATE_DIR points at

# Latest agent-side log (Claude Code):
ls -t ~/Library/Caches/claude-cli-nodejs/-Users-*-metro/mcp-logs-plugin-metro-metro/*.jsonl | head -1 | xargs cat
```

## Caveats

- **Discord Message Content Intent** is privileged — toggle it in the Developer Portal. See above.
- **Telegram single-poller.** Telegram allows one `getUpdates` consumer per bot token. If two `metro tail` instances start, the second-comer detects the lockfile (`$METRO_STATE_DIR/.tail-lock`) and exits cleanly. Re-run after the first exits to take over.
- **No allowlist.** Anyone who can DM your bot or @-mention it can talk to your session. Run against bots you own.
- **Mid-task latency.** New messages surface at the next agent decision boundary — sub-second on Claude Code (lots of small tool calls), longer on Codex turns. Neither runtime can interrupt an in-progress LLM generation.
- **UI visibility.** Claude Code's `Monitor` collapses stdout into a card; Codex dims MCP tool args. Metro's MCP `instructions` direct the agent to echo each inbound in its visible reply so you see what arrived without expanding cards.
