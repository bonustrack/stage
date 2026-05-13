---
name: metro
description: Run the metro Telegram/Discord bridge in this session — launch `metro` in the background, watch its stdout for inbound JSON events, and act on each. Use when the user asks to start/run/launch metro, when you see JSON lines on stdout shaped `{"type":"inbound","station":...,"line":"metro://...","messageId":...,"text":...}`, or when handling a chat reply/edit/react/send/download/fetch/notify.
---

# Metro — running the Telegram & Discord bridge

Metro is a CLI bridge between this agent session and Telegram/Discord. You launch `metro` once when the user asks, then act on each inbound JSON line via `metro <subcommand>`.

## Starting the bridge

When the user asks to run/start/launch metro:

### Claude Code

```
Bash(command: "metro", run_in_background: true)
```

Then attach `Monitor` to its stdout. Each line is one JSON event. Stderr is pino logs — don't act on it.

### Codex

```
shell(command: "METRO_CODEX_RC=ws://127.0.0.1:8421 metro", run_in_background: true)
```

Codex has no Monitor equivalent. Instead, metro pushes each event into your thread via JSON-RPC `turn/start`, so events arrive as user input on your next turn. The user must have a daemon + TUI running on the **same WebSocket URL**:

```
codex app-server --listen ws://127.0.0.1:8421     # daemon (terminal 1)
codex --remote ws://127.0.0.1:8421                # TUI (terminal 2) — type "hi" once to create a live thread
```

Then metro starts third. If metro exits immediately or you see `thread not found` retries on its stderr, the TUI didn't create a thread yet — tell the user to type something in the TUI.

### Diagnostics

If something seems off, run `metro doctor`. Common causes: missing tokens (`metro setup telegram <token>` / `metro setup discord <token>`), Discord Message Content Intent not toggled, stale lockfile, or (Codex) no live thread on the daemon.

## Event shape

Every line on stdout is one JSON object. Each event carries:
- `id` (`msg_…`) — universal message ID minted by metro
- `ts` — ISO timestamp
- `from` — universal **participant URI** of the sender (a Line)
- `fromName` — optional human-readable display name (`@alice`, `bonustrack_`)
- `line` — the conversation URI (also the implicit `to`)
- `messageId` — the platform-side id (Discord snowflake, Telegram int, …)
- `text` — universal display projection. Includes `[image]`/`[file: …]`/`[voice]`/`[audio]` tags inline.
- `payload` — raw platform-native message object. Shape varies per `station`.

```json
{"type":"inbound","id":"msg_aB3xY7zP","ts":"2026-05-14T12:00:00Z","station":"telegram","line":"metro://telegram/-100…/247","from":"metro://telegram/user/12345","fromName":"@alice","messageId":"4567","text":"hi [image]","lineName":"infra","payload":{"message_id":4567,"chat":{"id":-100,"type":"supergroup","is_forum":true},"from":{"id":12345,"username":"alice"},"text":"hi","photo":[{"file_id":"…"}],"reply_to_message":{"message_id":4500,"text":"earlier","from":{"id":99,"username":"bob"}}}}
```

```json
{"type":"notification","id":"msg_pQ4r5sT0","ts":"…","line":"metro://claude/deploys","from":"metro://codex/ci","text":"deploy green"}
```

### `payload` by station

`payload` is the platform's native message shape. Narrow on `event.station`:

- **`discord`** — discord.js `Message.toJSON()`: camelCase fields (`channelId`, `guildId`, `content`, `author`, `mentions: { users[], roles[], everyone }`, `attachments[]`, `reference`, …). Collections come back as **arrays of IDs**. `referencedMessage` is added inline on replies (auto-fetched).
- **`telegram`** — raw Bot API `Message` (snake_case): `{ message_id, chat, from, text, caption, entities[], photo[], document, voice, audio, reply_to_message, … }`. `reply_to_message` is inline on replies.

Use `payload` for anything the envelope doesn't surface — mentions, reply chains, embeds, entities.

## Detecting "is this for me?"

Derive from `payload`. Bot id per station is cached in `$METRO_STATE_DIR/bot-ids.json` (`{discord:"<userId>", telegram:"<userId>"}`, written by the daemon on start).

- **discord** — DM when `payload.guildId == null`; otherwise pinged when `payload.mentions.users.includes(<bot-id>)`.
- **telegram** — DM when `payload.chat.type === 'private'`; otherwise pinged when any entity in `payload.entities` (or `caption_entities`) is `{type:"mention"}` matching `@<bot-username>` or `{type:"text_mention", user:{id:<bot-id>}}`.

Default: only reply on DM or ping; otherwise stay silent or `metro react` to ack.

Both `from` and `to` are **participant URIs** (the conversation context lives in `line`):
- `metro://<station>/user/<id>` — a person on a chat platform
- `metro://claude/<topic>` / `metro://codex/<topic>` — an agent
- `metro://<station>/<channelId>` — a channel (used as `to` for fresh sends to a group, where no single recipient)

When **you** send via `metro send`/`reply`/`edit`/`react`, metro auto-stamps `from = metro://claude/agent` (from `$CLAUDECODE`) or `metro://codex/agent` (from `$METRO_CODEX_RC` / `$CODEX_HOME`). Override with `--from=<uri>` or `$METRO_FROM`. When replying/reacting, `to` is automatically the original sender (looked up via the universal id).

The `id` is the **canonical handle** for that message across all stations — store it if you want to refer back to it later.

- `type: "inbound"` — a human (or another bot) posted on a chat platform.
- `type: "notification"` — another agent called `metro notify` / `metro send` against your agent line. This is how Codex pings Claude Code and vice versa.

`text` may contain `[image]`, `[voice]`, `[audio]`, or `[file: <name>]` placeholders alongside the real text — non-image attachments are opaque markers; images can be materialized via `metro download`.

## Required flow on every event

1. **Echo to your visible output**: `[<line>#<messageId>] <text>` on its own line. Both Claude Code's Monitor and Codex collapse tool output, so this echo is the only way the user sees what arrived without expanding cards.
2. **Decide and act** using the subcommands below.

No server-side auto-reaction — don't expect 👀 to be on the user's message; add one yourself with `metro react` if you want to ack quickly.

## Subcommands

All take positional args (no `--to=`/`--text=` flags). Append `--json` to any for a parseable single-line result.

| Action | Command |
|---|---|
| Quote-reply (threads under original) | `metro reply <line> <messageId> <text>` |
| Send a fresh message (no reply context) | `metro send <line> <text>` |
| Edit a message you previously sent | `metro edit <line> <messageId> <text>` |
| Reaction (empty emoji clears) | `metro react <line> <messageId> <emoji>` |
| Download `[image]` attachments → paths | `metro download <line> <messageId> [--out=<dir>]` |
| Recent channel history (Discord only) | `metro fetch <line> [--limit=20]` |
| Ping another agent (cross-agent line) | `metro send metro://claude/<topic> <text>` or `metro notify <line> <text> [--from=<line>]` |

`reply` / `send` / `edit` accept multi-line text via stdin (heredoc).

### Rich content flags

`send` and `reply` accept these extra flags; `edit` accepts `--buttons` only.

- `--image=<path>` — upload a local image. **Repeatable** for albums: `--image=a.png --image=b.png`. Comma-separated also works: `--image='a.png,b.png'`. Up to 10 / message. Text becomes the caption (on the first image for albums).
- `--document=<path>` — upload any local file (PDF, log, csv, …). Same repeat/comma syntax.
- `--voice=<path>` — single voice message (`.ogg` Opus or `.mp3`). On Telegram renders as a voice bubble via `sendVoice`; on Discord uploaded as an audio attachment.
- `--buttons='[[{"text":"…","url":"https://…"}]]'` — attach an inline URL-button keyboard. 2D array: outer = rows, inner = buttons on that row.

```bash
metro send <line> "screenshot"                     --image=/tmp/build.png
metro send <line> "before/after"                   --image=/tmp/before.png --image=/tmp/after.png
metro reply <line> <id> "log + transcript"          --document=/tmp/run.log --document=/tmp/transcript.txt
metro send <line> "have a listen"                  --voice=/tmp/note.ogg
metro send <line> "approve?" --buttons='[[{"text":"Open PR","url":"https://github.com/x/y/pull/1"}]]'
metro edit <line> <id> "still working…" --buttons='[]'    # clears buttons
```

Limits / quirks:
- 20 MB per file (both platforms).
- Telegram albums are single-type (all photos OR all documents in one album). Mixing kinds in one send still works — metro splits into two album messages and returns the first id.
- Telegram drops `--buttons` when multiple attachments are sent (the bot API doesn't allow `reply_markup` on media groups).
- URL buttons only (no callback / interactive components yet).

## When to use `reply` vs `send`

- **`reply`** — responding to a specific inbound message. Threads under it. Default for handling an `inbound` event.
- **`send`** — initiating without a triggering message: a long task finished, a follow-up the user asked you to deliver later, or posting to an agent line (`metro://claude/...`, `metro://codex/...`) to notify a peer.

## Line URI scheme

`metro://<station>/<path>` — see [docs/uri-scheme.md](https://github.com/bonustrack/metro/blob/main/docs/uri-scheme.md) for the full grammar.

| Station    | Pattern                                   | Example                              |
|------------|-------------------------------------------|--------------------------------------|
| `discord`  | `metro://discord/<channel-id>`            | `metro://discord/1234567890`         |
| `telegram` | `metro://telegram/<chat-id>[/<topic-id>]` | `metro://telegram/-1001234567890/42` |
| `claude`   | `metro://claude/<topic>`                  | `metro://claude/deploys`             |
| `codex`    | `metro://codex/<topic>`                   | `metro://codex/ci`                   |

The `messageId` is **not** part of the URI — it's a separate positional arg for `reply` / `edit` / `react` / `download`.

## Image attachments

When an event's `text` contains `[image]`:

1. `metro download <line> <messageId>` — writes images to disk and prints absolute paths.
2. `Read` each path with your Read tool — the image enters your context as a vision input.
3. Reply normally with `metro reply`.

## Opaque attachment markers

`[voice]`, `[audio]`, and `[file: <name>]` are opaque — `metro download` only handles images. Acknowledge in text or ask the user to resend as a regular file.

## Cross-agent notification

Both agents can post to each other's "agent line":

```bash
metro send metro://claude/deploys "build green, ready to ship"
# or
metro notify metro://codex/ci "build green" --from=metro://claude/deploys
```

The daemon re-emits the post on its stdout stream (and pushes via codex-rc if configured), so the peer agent sees a `{"type":"notification",...}` event. Requires the metro daemon to be running on the machine — agent-line sends error with `metro daemon is not running` otherwise.

## Discoverability

- `metro lines` — list recently-seen conversations (sorted by recency).
- `metro stations` — list stations + capability matrix.
- `metro history` — universal message log (every inbound + outbound + notification across all stations). Newest first. Filters:
  - `--limit=N` (default 50)
  - `--line=<metro://…>` — only this conversation
  - `--station=<discord|telegram|claude|codex>`
  - `--kind=<inbound|outbound|edit|react|notification>`
  - `--from=<sender>`
  - `--text=<substring>`
  - `--since=<iso>` — e.g. `--since=2026-05-14T00:00:00Z`
  - `--json` — machine-parseable

Every action you take is logged automatically — `metro send`/`reply`/`edit`/`react` append outbound entries, daemon-side inbounds + notifications append on arrival. Stored at `$METRO_STATE_DIR/history.jsonl`.

## Universal message IDs

The `id` from `metro history` or an event JSON works **anywhere a `<message_id>` argument is expected**:

```bash
# Either form works for reply/edit/react/download:
metro reply <line> 4567                "ack"     # platform messageId (Telegram int)
metro reply <line> msg_aB3xY7zP        "ack"     # universal — resolves via history
```

Use universal IDs when chaining commands or referring back to a specific message across stations.

## Exit codes

- `0` success
- `1` usage error (bad args, unknown subcommand)
- `2` configuration error (no tokens — tell the user to run `metro setup`)
- `3` upstream error (rate limit, auth, network) — retry once after a few seconds before surfacing

`metro doctor` diagnoses tokens, gateways, dispatcher liveness, and codex-rc target.

## --json output

Every command supports `--json` for stable parseable output:

```bash
metro reply <line> <messageId> "ack" --json
# {"ok":true,"line":"metro://discord/...","replyTo":"...","messageId":"..."}

metro fetch metro://discord/1234 --limit=10 --json
# {"ok":true,"line":"...","messages":[{"messageId":"...","author":"...","text":"...","timestamp":"..."},...]}

metro download <line> <messageId> --json
# {"ok":true,"line":"...","files":[{"path":"/abs/...png","mediaType":"image/png"}]}
```

Use `--json` when you need to chain calls or capture the new `messageId` for a later edit.

## Don'ts

- ❌ Spawning a second metro daemon — there's one per machine (lockfile-enforced).
- ❌ Posting to a line that isn't in `metro lines` unless the user gave it to you explicitly.
- ❌ Narrating the tool ("I'll now use metro reply to…"). The tool call is already visible to the user.
