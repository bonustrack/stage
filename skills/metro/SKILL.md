---
name: metro
description: Handle Telegram/Discord messages from `metro` for this agent session. Use when the user asks to start/run/launch metro, when you see JSON lines on stdout or as user input shaped `{"platform":..., "to":..., "text":...}`, or when handling chat reply/react/edit/send/download/fetch.
---

# Metro — handling the Telegram & Discord bridge

Metro is a CLI bridge between this agent session and Telegram/Discord. Each inbound message arrives as a JSON line; you act on it via `metro <subcommand>`. The launch mechanics differ between Claude Code (you launch metro via shell) and Codex (the user launches metro outside the agent and the daemon pushes turns to you).

## Starting the bridge

When the user asks to run/start/launch metro, you launch it as a backgrounded shell command. The exact invocation depends on the runtime:

### Claude Code

```
Bash(command: "metro", run_in_background: true)
```

Then attach `Monitor` to its stdout. Each stdout line is one inbound JSON event you act on directly.

### Codex

```
shell(command: "METRO_CODEX_RC=ws://127.0.0.1:8421 metro", run_in_background: true)
```

Don't watch its stdout — Codex has no Monitor equivalent. Instead, metro pushes each inbound into your thread via JSON-RPC `turn/start`, so events arrive as user input on your next turn. The user must have a daemon and the TUI running for this to work — refer them to:

```
codex app-server --listen ws://127.0.0.1:8421       # daemon (terminal 1)
codex --remote ws://127.0.0.1:8421                  # TUI (this session — terminal 2)
```

If `metro` exits immediately or the daemon isn't on 8421, ask the user. (`codex remote-control` is stdio-only and doesn't work for this flow.)

### Per-session scoping (multi-session, opt-in)

If the user wants multiple agent sessions to share one bot, scope each metro to its own Discord thread and/or Telegram forum topic:

```
METRO_DISCORD_THREAD=<thread_channel_id> metro          # Discord-scoped
METRO_TELEGRAM_TOPIC=<chat_id>:<topic_id> metro         # Telegram-scoped
```

Inbounds outside the scope are dropped silently — only messages in the configured thread/topic reach this session. Outbound `metro reply / edit / send` calls automatically thread back into the same Telegram topic, so replies land where the user expects.

If you launch metro on the user's behalf and they've asked for scoped behavior, prepend the env var to the shell command. Example for a Codex session in a Telegram topic:

```
shell(command: "METRO_CODEX_RC=ws://127.0.0.1:8421 METRO_TELEGRAM_TOPIC=-1001234567890:42 metro", run_in_background: true)
```

### Diagnostics

If something seems off, run `metro doctor`. Common causes: missing tokens (`metro setup telegram <token>` / `metro setup discord <token>`), Discord Message Content Intent not toggled, stale lockfile. On Codex, also: app-server not listening on the expected URL, or the TUI not attached via `--remote`. If scope filters are set, also check that the user's actual messages match the configured thread/topic id (`metro` logs `inbound rejected by … filter` at debug level).

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
