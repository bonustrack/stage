# Metro

Telegram + Discord channel for Claude Code and Codex. Sub-second inbound delivery, same setup on both runtimes: register an MCP server, run a tail script in the background, react to JSON lines. The agent responds with `reply` / `react` / `edit-message` per platform. One local stdio MCP, no hosted infra.

## Install

```bash
git clone https://github.com/bonustrack/metro && cd metro
bun install
cat > .env <<'EOF'
TELEGRAM_BOT_TOKEN=…   # from @BotFather
DISCORD_BOT_TOKEN=…    # from discord.com/developers/applications
EOF
chmod 600 .env
```

**Discord gotcha**: enable **Message Content Intent** in the Developer Portal → Bot → Privileged Gateway Intents.

## Claude Code

```bash
claude mcp add metro -- bun run --cwd $(pwd) --silent start
claude
```

In your session, prompt the agent:

> Run `bun $(pwd)/src/tail.ts` in the background and Monitor its stdout. Each line is a JSON inbound message — when one arrives, echo `[telegram chat_id=X] <content>` (or `[discord channel_id=X] <content>`) in your reply, then call the matching `*-reply` tool.

DM either bot. Sub-second delivery. A CLAUDE.md line can make this automatic on every session:

```md
On session start, run `bun /path/to/metro/src/tail.ts` in the background and
Monitor its stdout for Telegram/Discord messages.
```

## Codex

Same MCP registration, same tail pattern:

```bash
codex mcp add metro -- bun run --cwd $(pwd) --silent start
codex
```

Same prompt. Codex uses `unified_exec` + `write_stdin` polling under the hood — sub-second when messages arrive (server-side long-poll, ~1 round-trip per actual message), ~5s yield when idle.

## Tools

| Platform | Tools |
|---|---|
| Telegram | `telegram-reply`, `telegram-react`, `telegram-edit-message`, `telegram-download-attachment` |
| Discord  | `discord-reply`, `discord-react`, `discord-edit-message`, `discord-download-attachment`, `discord-fetch-messages` |

`*-download-attachment` returns image content blocks. Telegram persists recent `file_id`s on disk at `<repo-root>/telegram-attachments.json` so the writer (`tail.ts`) and the reader (`server.ts`) share state. Voice/audio surface as opaque `[voice]` / `[audio]` placeholders. `discord-fetch-messages` is Discord-only — Discord exposes no search API for bots.

## Config

`<repo-root>/.env`:

```
TELEGRAM_BOT_TOKEN=123456:ABC…
DISCORD_BOT_TOKEN=MTIz…
```

- `METRO_LOG_LEVEL` (trace|debug|info|warn|error|fatal) — log verbosity, default `info`. Logs go to stderr (captured by Claude Code under `~/Library/Caches/claude-cli-nodejs/…/mcp-logs-plugin-metro-metro/*.jsonl`).
- `METRO_ACK_EMOJI` — auto-react emoji `tail.ts` fires on every inbound, default `👀`. Empty disables. Telegram restricts the [bot reaction set](https://core.telegram.org/bots/api#reactiontypeemoji).

## Architecture

```
Telegram ─poll(getUpdates)──┐
                            ├─▶  src/tail.ts  ─stdout JSON lines─▶  agent (Monitor / unified_exec)
Discord  ─gateway WS────────┘
                                      │
                                      └─▶  src/server.ts (MCP) ◀─ tool calls
```

Two scripts: `tail.ts` is the inbound stream (agent runs it in the background, observes stdout), `server.ts` is the outbound MCP server (registered once with `claude mcp add` / `codex mcp add`). Both runtimes use the same approach.

## Caveats

- **Discord Message Content Intent** required (privileged) — see install gotcha above.
- **Telegram single-poller.** Two Metro instances on the same token will fight for the `getUpdates` slot; Discord allows multiple gateway connections.
- **No pairing/allowlist.** Anyone who can DM your bot or @-mention it in a channel can talk to your session. Run against bots you own.
- **UI visibility.** Claude Code's `Monitor` collapses stdout into a card; Codex dims MCP tool args. The MCP `instructions` direct the agent to echo each inbound message in its visible reply so you can see what arrived without expanding cards.
- **Mid-task latency.** When the agent is mid-tool-call, new messages surface at the next decision boundary — typically sub-second on Claude Code, longer on Codex turns. Neither runtime can interrupt an in-progress LLM generation.
