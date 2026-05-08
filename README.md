# Metro

Telegram + Discord channel for Claude Code and Codex. Sub-second inbound delivery, same setup on both runtimes: register an MCP server, run a tail script in the background, react to JSON lines. The agent responds with `reply` / `react` / `edit-message` per platform. One local stdio MCP, no hosted infra.

## Install

```bash
git clone https://github.com/bonustrack/metro && cd metro
bun install
bun link             # exposes `metro` on PATH (~/.bun/bin/metro)

cp .env.example .env
chmod 600 .env
$EDITOR .env          # fill in TELEGRAM_BOT_TOKEN and/or DISCORD_BOT_TOKEN
```

**Discord gotcha**: enable **Message Content Intent** in the Developer Portal → Bot → Privileged Gateway Intents.

## Claude Code

```bash
claude mcp add metro -- metro mcp
claude
```

In your session, prompt the agent:

> Run `metro tail` in the background and Monitor its stdout. Each line is a JSON inbound message — when one arrives, echo `[telegram chat_id=X] <content>` (or `[discord channel_id=X] <content>`) in your reply, then call the matching `*-reply` tool.

DM either bot. Sub-second delivery. A CLAUDE.md line can make this automatic on every session:

```md
On session start, run `metro tail` in the background and Monitor its stdout
for Telegram/Discord messages.
```

## Codex

Same MCP registration, same tail pattern:

```bash
codex mcp add metro -- metro mcp
codex
```

Same prompt. Codex uses `unified_exec` + `write_stdin` polling under the hood — sub-second when messages arrive (server-side long-poll, ~1 round-trip per actual message), ~5s yield when idle.

## Tools

| Platform | Tools |
|---|---|
| Telegram | `telegram-reply`, `telegram-react`, `telegram-edit-message`, `telegram-download-attachment` |
| Discord  | `discord-reply`, `discord-react`, `discord-edit-message`, `discord-download-attachment`, `discord-fetch-messages` |

`*-download-attachment` returns image content blocks. Telegram persists recent `file_id`s on disk at `<repo-root>/telegram-attachments.json` so the writer (`metro tail`) and the reader (`metro mcp`) share state. Voice/audio surface as opaque `[voice]` / `[audio]` placeholders. `discord-fetch-messages` is Discord-only — Discord exposes no search API for bots.

## Config

`<repo-root>/.env`:

```
TELEGRAM_BOT_TOKEN=123456:ABC…
DISCORD_BOT_TOKEN=MTIz…
```

- `METRO_LOG_LEVEL` (trace|debug|info|warn|error|fatal) — log verbosity, default `info`. Logs go to stderr (captured by Claude Code under `~/Library/Caches/claude-cli-nodejs/…/mcp-logs-plugin-metro-metro/*.jsonl`).
- `METRO_ACK_EMOJI` — auto-react emoji `metro tail` fires on every inbound, default `👀`. Empty disables. Telegram restricts the [bot reaction set](https://core.telegram.org/bots/api#reactiontypeemoji).

## Architecture

```
Telegram ─poll(getUpdates)──┐
                            ├─▶  metro tail  ─stdout JSON lines─▶  agent (Monitor / unified_exec)
Discord  ─gateway WS────────┘
                                      │
                                      └─▶  metro mcp  ◀─ tool calls
```

Two commands: `metro tail` is the inbound stream (agent runs it in the background, observes stdout), `metro mcp` is the outbound MCP server (registered once with `claude mcp add` / `codex mcp add`). Both runtimes use the same approach. While the agent is working on a reply, both platforms show a typing indicator; when the agent replies, the indicator stops and the auto-acknowledgement reaction is cleared on the exact message replied to.

## Caveats

- **Discord Message Content Intent** required (privileged) — see install gotcha above.
- **Telegram single-poller.** Two `metro tail` instances on the same token would fight for the `getUpdates` slot, so the second-comer detects the existing owner (via `.tail-lock`) and exits cleanly. Re-run `metro tail` to take over after the owner exits.
- **No pairing/allowlist.** Anyone who can DM your bot or @-mention it in a channel can talk to your session. Run against bots you own.
- **UI visibility.** Claude Code's `Monitor` collapses stdout into a card; Codex dims MCP tool args. The MCP `instructions` direct the agent to echo each inbound message in its visible reply so you can see what arrived without expanding cards.
- **Mid-task latency.** When the agent is mid-tool-call, new messages surface at the next decision boundary — typically sub-second on Claude Code, longer on Codex turns. Neither runtime can interrupt an in-progress LLM generation.
