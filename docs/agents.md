# Metro: a guide for coding agents

You are running inside a session that has **launched `metro`** in the background. Metro emits a live stream of JSON events from Discord, Telegram, and other agents on its stdout. Your job is to consume that stream and post replies back via subcommands.

## Starting the bridge

The launch mechanics differ by runtime — pick the one that matches yours.

### Claude Code

```
Bash(command: "metro", run_in_background: true)
```

Then attach `Monitor` to its stdout. Each line is one JSON event you act on.

### Codex

```
shell(command: "METRO_CODEX_RC=ws://127.0.0.1:8421 metro", run_in_background: true)
```

Don't watch its stdout — Codex has no Monitor equivalent. Metro pushes each event into your thread via JSON-RPC `turn/start`, so events arrive as user input on your next turn. The user must have a daemon and TUI running for this to work:

```
codex app-server --listen ws://127.0.0.1:8421       # daemon (terminal 1)
codex --remote ws://127.0.0.1:8421                  # TUI (this session — terminal 2)
```

Run `metro doctor` if anything seems off.

## Event shape

Every event carries `id` (`msg_…`), `ts`, `from` (a universal participant URI), `fromName` (display name), `line` (conversation = `to`), and `messageId` (the platform-side id). `text` is a universal projection that includes `[image]` / `[file: …]` / `[voice]` / `[audio]` tags inline. `payload` carries the raw platform-native message object — shape varies per `station`.

```json
{"type":"inbound","id":"msg_aB3xY7zP","ts":"2026-05-14T12:00:00Z","station":"telegram","line":"metro://telegram/-100…/247","from":"metro://telegram/user/12345","fromName":"@alice","messageId":"4567","text":"hello [image]","lineName":"infra","payload":{"message_id":4567,"chat":{"id":-100,"type":"supergroup","is_forum":true},"from":{"id":12345,"username":"alice"},"text":"hello","entities":[{"type":"mention","offset":0,"length":6}],"photo":[{"file_id":"…"}],"reply_to_message":{"message_id":4500,"text":"earlier message","from":{"id":99,"username":"bob"}}}}
```

```json
{"type":"notification","id":"msg_pQ4r5sT0","ts":"…","line":"metro://claude/deploys","from":"metro://codex/ci","text":"deploy succeeded"}
```

### `payload` by station

`payload` is the platform's native message shape. Narrow on `event.station`:

- **`discord`** — discord.js `Message.toJSON()`: camelCase fields (`channelId`, `guildId`, `content`, `author`, `mentions: { users[], roles[], everyone }`, `attachments[]`, `reference`, …). Collections come back as **arrays of IDs**. `referencedMessage` (also `toJSON()`-shaped) is added inline on replies (auto-fetched).
- **`telegram`** — raw Bot API `Message` (snake_case): `{ message_id, chat, from, text, caption, entities[], photo[], document, voice, audio, reply_to_message, … }`. `reply_to_message` is inline on replies.

Use `payload` for anything the envelope doesn't surface — mentions, reply chains, embeds, stickers, entities.

Both `from` and `to` are **participant URIs** (the conversation lives in `line`): `metro://<station>/user/<id>` for a person, `metro://claude/<topic>` / `metro://codex/<topic>` for an agent, `metro://<station>/<channelId>` as a fallback `to` when sending to a group with no single recipient.

When **you** call `metro send`/`reply`/`edit`/`react`, metro auto-stamps `from` to your runtime — `metro://claude/agent` (from `$CLAUDECODE`) or `metro://codex/agent` (from `$METRO_CODEX_RC`/`$CODEX_HOME`). Override with `--from=<uri>` or `$METRO_FROM`. When replying/reacting, `to` is auto-set to the original sender (history lookup).

- `type: "inbound"` — a human (or another bot) posted on a chat platform.
- `type: "notification"` — another agent called `metro notify`/`metro send` against your agent line. This is how Codex pings Claude Code and vice versa.

`text` may include `[image]` / `[voice]` / `[audio]` / `[file: <name>]` placeholders alongside the real text — non-image attachments are opaque markers, images can be materialized via `metro download`.

## Required flow on every event

1. **Echo the event** to your visible output: `[<line>#<messageId>] <text>`. Both Monitor and Codex collapse tool output, so this echo is the only thing the user sees without expanding cards.
2. **Decide and act** using the subcommands below.

## Detecting "is this for me?"

Derive from `payload`. Bot id per station is in `$METRO_STATE_DIR/bot-ids.json` (`{discord:"<userId>", telegram:"<userId>"}`).

- **`discord`** — DM if `payload.guildId == null`; otherwise pinged if `payload.mentions.users.includes(<bot-id>)`.
- **`telegram`** — DM if `payload.chat.type === 'private'`; otherwise pinged if any entity in `payload.entities` (or `caption_entities`) is `{type:"mention"}` matching `@<bot-username>`, or `{type:"text_mention", user:{id:<bot-id>}}`.

Default: only reply on DM or ping; otherwise stay silent or `metro react` to ack.

## Subcommands

| Action | Command |
|---|---|
| Quote-reply (threads under original) | `metro reply <line> <messageId> <text>` |
| Send a fresh message (no reply context) | `metro send <line> <text>` |
| Edit a message you previously sent | `metro edit <line> <messageId> <text>` |
| Reaction (empty emoji clears it) | `metro react <line> <messageId> <emoji>` |
| Download `[image]` attachments | `metro download <line> <messageId> [--out=<dir>]` |
| Recent-message lookback (Discord only) | `metro fetch <line> [--limit=20]` |
| Cross-agent ping | `metro notify <line> <text> [--from=<line>]` |

`reply` / `send` / `edit` accept multi-line text via stdin (heredoc).

### Rich content flags

`send` and `reply` accept these flags; `edit` accepts `--buttons` only.

- `--image=<path>` — local image. **Repeatable** for albums: `--image=a.png --image=b.png` (or comma-separated). Up to 10 / message. Text becomes the caption (on the first image for albums).
- `--document=<path>` — local file (PDF, log, csv, …). Same repeat/comma syntax.
- `--voice=<path>` — single voice message (`.ogg` Opus or `.mp3`). On Telegram renders as a voice bubble; on Discord uploaded as audio attachment.
- `--buttons='[[{"text":"…","url":"…"}]]'` — inline URL-button keyboard (2D rows × buttons). Pass `'[]'` to `edit` to clear.

```bash
metro send <line> "screenshot" --image=/tmp/build.png
metro send <line> "before/after" --image=/tmp/before.png --image=/tmp/after.png
metro reply <line> <id> "voice note" --voice=/tmp/note.ogg
metro send <line> "approve?" --buttons='[[{"text":"Open PR","url":"https://github.com/x/y/pull/1"}]]'
```

Limits: 20 MB / file. Telegram albums are single-type (photos OR documents per album); mixing kinds still works — metro splits into two messages. Buttons are dropped on multi-attachment Telegram sends. URL buttons only for now.

Append `--json` to any command for a single JSON line you can parse.

## When to use `reply` vs `send`

- **`reply`** — responding to a specific inbound message. Threads under it. Default when handling an `inbound` event.
- **`send`** — initiating without a triggering message: a long task you kicked off finished, a follow-up the user asked you to deliver later, or posting to an agent line (`metro://claude/...`, `metro://codex/...`) to notify a peer.

## Universal message IDs

The `id` field on every event and `metro history` row is metro's **universal ID** (`msg_<8 chars>`). It works anywhere a `<message_id>` is expected — `metro reply`, `edit`, `react`, `download` — and resolves to the platform's own id via the history file. Use it for chaining commands or referring back across stations.

## `metro history` — read the universal message log

Every inbound, outbound, edit, react, and notification is appended to `$METRO_STATE_DIR/history.jsonl` automatically.

```bash
metro history --limit=20                              # recent 20, newest first
metro history --line=metro://discord/123              # only this conversation
metro history --kind=inbound --since=2026-05-14       # inbounds since that day
metro history --station=telegram --text=deploy        # all Telegram entries containing "deploy"
metro history --from='@alice' --json                  # everything from alice, JSON
```

Filters: `--limit` (default 50), `--line`, `--station`, `--kind` (`inbound`/`outbound`/`edit`/`react`/`notification`), `--from`, `--text`, `--since` (ISO), `--json`.

## Discovery

### `metro lines`

```
$ metro lines
2m ago    metro://discord/1234567890           infra
5m ago    metro://telegram/-100123/42          design-review
```

Lines sorted by recency. Use when the user says "the Telegram channel" or "that PR thread."

### `metro stations`

```
$ metro stations
  ✓ discord    chat   in: text+image · out: text · features: reply, send, edit, react, download, fetch
  ✓ telegram   chat   in: text+image · out: text · features: reply, send, edit, react, download, fetch
  · claude     agent  in: text · out: – · features: notify
  ✓ codex      agent  in: text · out: – · features: notify
```

`✓` = ready, `✗` = configured-but-broken, `·` = informational (agent stations have no setup).

## Image attachments

When an inbound has an `[image]` tag in `text`:

1. `metro download <line> <messageId>` → prints absolute paths.
2. `Read` each path with your `Read` tool — the image enters your context as a vision input.
3. Reply normally via `metro reply`.

## Cross-agent notification

Both agents can post to each other's "agent line" — a logical channel under `metro://claude/<topic>` or `metro://codex/<topic>`. The daemon re-emits the post on its stdout stream (and pushes via codex-rc if configured), so the peer agent sees it as a notification:

```bash
metro send metro://claude/deploys "build green, ready to ship"
# or equivalently:
metro notify metro://claude/deploys "build green, ready to ship" --from=metro://codex/ci
```

This requires the metro daemon to be running on the machine. Without a daemon, agent-line sends error with a clear message.

## Don'ts

- ❌ Spawning a second metro daemon — there's one per machine (lockfile-enforced).
- ❌ `metro send` to a line that isn't in `metro lines` unless the user gave it to you explicitly.
- ❌ Narrating the tool ("I'll now use metro reply to…"). The tool call is already visible.

## Further reading

- URI scheme: [`uri-scheme.md`](uri-scheme.md)
- Source: https://github.com/bonustrack/metro
