---
name: metro
description: Run the metro Telegram/Discord bridge in this session — launch `metro` in the background, watch its stdout for inbound JSON lines, and act on each. Use when the user asks to start/run/launch metro, when you see JSON lines on stdout shaped `{"platform":..., "to":..., "text":...}`, or when handling a chat reply/react/edit/send/download/fetch.
---

# Metro — running the Telegram & Discord bridge

Metro is a CLI bridge between this agent session and Telegram/Discord. You launch `metro` once when the user asks, then act on each inbound JSON line via `metro <subcommand>`.

## Starting the bridge

When the user asks to run/start/launch metro (or "start the bridge"), the launch flow depends on which agent runtime you're in:

### Claude Code

1. Launch `metro` as a backgrounded Bash command (`run_in_background: true`).
2. Attach `Monitor` to its stdout. Each stdout line is one inbound JSON event.

### Codex

Codex has no Monitor equivalent — `unified_exec` is poll-only and can't push stdout between turns. So metro instead pushes events into the agent's history over JSON-RPC against the `codex remote-control` daemon. Setup is two commands:

1. The user must run `codex remote-control` once per machine — this enables the managed app-server daemon listening on a default UDS (`$CODEX_HOME/app-server-control/app-server-control.sock`). If they're not running it, ask them to.
2. `metro` auto-detects that socket and connects. No env var needed in the common case. If they have a non-standard setup, `METRO_CODEX_RC` overrides the URL.
3. Each inbound triggers a `turn/start` on the active codex thread — the JSON line lands as user input on the agent's next turn. Process and respond normally.

### Either runtime

If `metro` exits immediately or no inbounds arrive within a minute of a known DM, run `metro doctor` to diagnose. Common causes: missing tokens (`metro setup telegram <token>` / `metro setup discord <token>`), Discord Message Content Intent not toggled, stale lockfile from a previous session. On Codex, also: `METRO_CODEX_RC` not set, app-server not running, or no active thread on the daemon.

## Inbound shape

Each `metro` line on stdout:

```json
{"platform":"telegram"|"discord","to":"<platform>:<chat>/<message_id>","text":"…"}
```

`text` may include placeholders for non-text content: `[image]`, `[voice]`, `[audio]`, `[file: <name>]`. Voice/audio are opaque markers — you can't download them.

Discord guild messages preserve the user's raw mention markup, including the bot's own `<@bot_id>` (the gate that made the message visible). Treat the bot's own mention as metadata; other users' mentions (`<@some_other_id>`) can be addressee context. Reply normally — the message is addressed to you regardless of where the mention sits.

## Required flow on every inbound

1. **Echo to the visible reply.** Write `[<to>] <text>` on its own line in your visible output. Both Claude Code's Monitor and Codex dim/collapse tool output, so this echo is the only way the user sees what arrived without expanding cards.
2. **Decide and act.** Pick the matching subcommand below.

> 👀 is already on the message — `metro` auto-reacts server-side on every inbound and clears the reaction when you reply. Don't call `metro react --emoji=👀` yourself; you'd just flicker it on/off and waste a tool call.

## Subcommands

`reply` / `react` / `edit` / `download` take `--to=<platform>:<chat>/<message_id>` copied verbatim from the inbound `to` field. `send` and `fetch` take a channel-only `--to=<platform>:<chat>` (no message id). Append `--json` to any of them for a single JSON result line you can parse.

| Action | Command |
|---|---|
| Quote-reply (threads under original; clears 👀) | `metro reply --to=<to> --text=<reply>` |
| Quick ack reaction | `metro react --to=<to> --emoji=👍` |
| Edit your previous bot message | `metro edit --to=<to> --text=<new text>` |
| Send a proactive message (no reply context) | `metro send --to=<platform>:<chat_id> --text=<msg>` |
| Download `[image]` attachments → file paths | `metro download --to=<to>` |
| Fetch recent channel history (Discord only) | `metro fetch --to=discord:<channel_id> --limit=20` |

`reply` / `edit` / `send` accept multi-line `--text` via stdin (heredoc).

## When to use `send` vs `reply`

- **`reply`** — responding to a specific inbound message. Threads under it. This is the default when handling a `metro` inbound line.
- **`send`** — initiating without a triggering message: a long task you kicked off finished, a scheduled job fired, a follow-up the user asked you to deliver later. The chat/channel id you target must be one the bot can reach (existing DM, joined guild channel).

## Address format

- `telegram:<chat_id>/<message_id>` — copied straight from inbound `to`
- `discord:<channel_id>/<message_id>` — same
- `discord:<channel_id>` — channel-only, used for `metro fetch`

## Image attachments

When `text` contains `[image]`:

1. Run `metro download --to=<to>` — writes images to disk and prints absolute paths (one per line).
2. `Read` each path with the Read tool — the image enters your context as a vision input.
3. Reply normally with `metro reply`.

## Opaque attachment markers

`[voice]`, `[audio: <name>]`, and `[file: <name>]` are opaque — `metro download` only handles images. Acknowledge in text (e.g., "got your voice note — could you type it out?") or, if your runtime accepts audio/file input directly, ask the user to resend as a regular file.

## Exit codes

- `0` success
- `1` usage error (bad flags, unknown subcommand)
- `2` configuration error (no tokens; tell the user to run `metro setup`)
- `3` upstream error (rate limit, auth, network) — wait a few seconds and retry once before surfacing to the user

If anything's misbehaving, run `metro doctor` to see which check fails.

## --json output

Every action command supports `--json` for stable, parseable output:

```bash
metro reply --to=… --text=… --json
# {"ok":true,"platform":"discord","to":"discord:123/456","sent_message_id":"…"}

metro fetch --to=discord:1234 --limit=10 --json
# [{"message_id":"…","author":"…","text":"…","timestamp":"…"}, …]

metro download --to=… --json
# {"images":[{"path":"/abs/…png","mime":"image/png"}]}
```

Use `--json` when you need to chain calls or capture the new message_id for a later edit.
