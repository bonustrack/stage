# Metro

Telegram + Discord channel for Claude Code and Codex. Sub-second inbound delivery, same setup on both runtimes: register an MCP server, run a tail script in the background, react to JSON lines. The agent responds with `reply` / `react` / `edit-message` per platform. One local stdio MCP, no hosted infra.

## Install

Configure tokens once:

```bash
mkdir -p ~/.claude/channels/metro
cat > ~/.claude/channels/metro/.env <<'EOF'
TELEGRAM_BOT_TOKEN=…   # from @BotFather
DISCORD_BOT_TOKEN=…    # from discord.com/developers/applications
EOF
chmod 600 ~/.claude/channels/metro/.env
```

**Discord gotcha**: enable **Message Content Intent** in the Developer Portal → Bot → Privileged Gateway Intents.

## Claude Code

```bash
# Register the outbound tools (reply, react, edit-message, download, fetch).
claude mcp add metro -- bun run --cwd /path/to/metro/plugins/metro --silent start

# Plain claude — no --channels flag needed.
claude
```

In your session, prompt the agent:

> Run `bun /path/to/metro/plugins/metro/src/tail.ts` in the background and Monitor its stdout. Each line is a JSON inbound message — when one arrives, echo `[telegram chat_id=X] <content>` (or `[discord channel_id=X] <content>`) in your reply, then call the matching `*-reply` tool.

DM either bot. Sub-second delivery. The agent reacts at the next tool-call boundary.

A CLAUDE.md line can make this automatic on every session:

```md
On session start, run `bun /path/to/metro/plugins/metro/src/tail.ts` in
the background and Monitor its stdout for Telegram/Discord messages.
```

## Codex

Same MCP registration, same tail pattern:

```bash
codex mcp add metro -- bun run --cwd /path/to/metro/plugins/metro --silent start

# Plain codex.
codex
```

Same prompt. Codex uses `unified_exec` + `write_stdin` polling under the hood — sub-second when messages arrive (server-side long-poll, only ~1 round-trip per actual message), ~5s yield when idle.

## Tools

Tools are namespaced per platform; only the families you've configured get registered.

| Platform | Tools |
|---|---|
| Telegram | `telegram-reply`, `telegram-react`, `telegram-edit-message`, `telegram-download-attachment` |
| Discord  | `discord-reply`, `discord-react`, `discord-edit-message`, `discord-download-attachment`, `discord-fetch-messages` |

`*-download-attachment` returns image content blocks for image attachments. Telegram persists recent `file_id`s in `~/.claude/channels/metro/telegram-attachments.json` so they survive a restart; Discord works on any reachable message. Voice/audio messages surface as `[voice]` / `[audio]` placeholders. `discord-fetch-messages` is Discord-only since Discord exposes no search API for bots.

## Config

Plugin reads `~/.claude/channels/metro/.env` (canonical), with two dev fallbacks: `<repo-root>/.env` and `plugins/metro/.env`. First reader wins per key.

```
TELEGRAM_BOT_TOKEN=123456:ABC…
DISCORD_BOT_TOKEN=MTIz…
```

`METRO_LOG_LEVEL` (trace|debug|info|warn|error|fatal) controls verbosity; default `info`. Logs go to stderr (Claude Code captures them in `~/Library/Caches/claude-cli-nodejs/.../mcp-logs-plugin-metro-metro/*.jsonl`).

## Architecture

```
Telegram ─poll(getUpdates)──┐
                            ├─▶  src/tail.ts  ─stdout JSON lines─▶  agent (Monitor / unified_exec)
Discord  ─gateway WS────────┘
                                      │
                                      └─▶  src/server.ts (MCP) ◀─ tool calls (reply / react / edit / …)
```

Two scripts: `tail.ts` is the inbound stream (the agent runs it in the background and observes its stdout), `server.ts` is the outbound MCP server (registered once with `claude mcp add` / `codex mcp add`). Both runtimes use the same approach.

## Caveats

- **Discord Message Content Intent** required (privileged) — see install gotcha above.
- **Telegram single-poller.** Two Metro runtimes on the same Telegram token will fight for the `getUpdates` slot; Discord allows multiple gateway connections.
- **No pairing/allowlist.** For Telegram, anyone with the bot's `@username` can DM your session. For Discord, the bot only forwards DMs and `@mention` messages — but anyone in those channels can talk to your session. Run against bots you own.
- **UI visibility.** Claude Code's `Monitor` collapses stdout into a "Monitor event" card by default; Codex renders MCP tool args in dim/wrapped lines. The agent's MCP `instructions` direct it to echo each inbound message in its visible reply (`[telegram chat_id=X] <content>`) so you can see what arrived without expanding cards.
- **Mid-task latency.** When the agent is mid-tool-call, new messages surface at the next decision boundary — typically sub-second on Claude Code (lots of small tool calls), longer on Codex turns. Neither runtime supports interrupting an in-progress LLM generation.
