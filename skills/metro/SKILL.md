---
name: metro
description: Handle inbound Telegram and Discord messages from `metro tail` running in the background. Use whenever you see JSON lines on stdout shaped `{"platform":..., "to":..., "text":...}`, or when the user asks you to reply/react/edit/download/fetch on a chat message.
---

# Metro — handling inbound Telegram & Discord messages

Metro is a CLI bridge between your agent session and Telegram/Discord. The user runs `metro` (alias for `metro tail`) in the background; one JSON line lands on stdout for every inbound message. You react, decide, and act with `metro <subcommand>`.

## Inbound shape

Each `metro tail` line on stdout:

```json
{"platform":"telegram"|"discord","to":"<platform>:<chat>/<message_id>","text":"…"}
```

`text` may include placeholders for non-text content: `[image]`, `[voice]`, `[audio]`, `[file: <name>]`. Voice/audio are opaque markers — you can't download them.

## Required flow on every inbound

1. **React 👀 first.** Your very first tool call after seeing an inbound line must be `metro react --to=<to> --emoji=👀`. The user sees this on their phone immediately — proof you noticed before you started thinking.
2. **Echo to the visible reply.** Write `[<to>] <text>` on its own line in your visible output. Both Claude Code's Monitor and Codex dim/collapse tool output, so this echo is the only way the user sees what arrived without expanding cards.
3. **Decide and act.** Pick the matching subcommand below.

## Subcommands

All take `--to=<platform>:<chat>/<message_id>` copied verbatim from the inbound `to` field. Append `--json` to any of them for a single JSON result line you can parse.

| Action | Command |
|---|---|
| Quote-reply (threads under original; clears 👀) | `metro reply --to=<to> --text=<reply>` |
| Quick ack | `metro react --to=<to> --emoji=👍` |
| Edit your previous bot message | `metro edit --to=<to> --text=<new text>` |
| Download `[image]` attachments → file paths | `metro download --to=<to>` |
| Fetch recent channel history (Discord only) | `metro fetch --to=discord:<channel_id> --limit=20` |

`reply` and `edit` accept multi-line `--text` via stdin (heredoc).

## Address format

- `telegram:<chat_id>/<message_id>` — copied straight from inbound `to`
- `discord:<channel_id>/<message_id>` — same
- `discord:<channel_id>` — channel-only, used for `metro fetch`

## Image attachments

When `text` contains `[image]`:

1. Run `metro download --to=<to>` — writes images to disk and prints absolute paths (one per line).
2. `Read` each path with the Read tool — the image enters your context as a vision input.
3. Reply normally with `metro reply`.

## Voice / audio

`[voice]` / `[audio]` markers are opaque. Acknowledge in text (e.g., "got your voice note — could you type it out?") or, if your runtime supports audio input via attached files, the user can resend as a regular file.

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
