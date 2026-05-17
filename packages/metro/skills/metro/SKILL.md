---
name: metro
description: Run the metro Telegram/Discord/webhook relay in this session — launch `metro` in the background, watch its stdout for inbound JSON events, and act on each. Use when the user asks to start/run/launch metro, when you see JSON lines on stdout shaped `{"kind":"inbound","station":...,"line":"metro://...","messageId":...,"text":...}`, or when handling a chat/webhook reply/edit/react/send/download/fetch.
---

# Metro — running the Telegram / Discord / webhook relay

Metro is a CLI that relays between this session and external sources: Telegram, Discord, and HTTP webhooks from third parties (GitHub, Intercom, Fireflies, …). You launch `metro` once when the user asks, then act on each inbound JSON line via `metro <subcommand>`.

## Starting metro

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

Every line on stdout is one **history entry** — the same record appended to `history.jsonl`. Fields:
- `kind` — `"inbound"`, `"outbound"`, `"edit"`, or `"react"`. Inbound `react` events fire when a human adds an emoji reaction in Discord/Telegram — `emoji` is set, `text` is omitted, `messageId` is the message that got reacted to.
- `id` (`msg_…`) — universal message ID minted by metro
- `ts` — ISO timestamp
- `station` — `"discord"`, `"telegram"`, `"claude"`, `"codex"`, `"webhook"`
- `line` — conversation URI; `lineName?` is the channel/topic display name (for webhooks: the label you gave it)
- `from` / `fromName?` — sender participant URI + optional display name
- `to` — recipient participant URI (local user for DMs, conversation `line` for groups, original sender for replies/reacts)
- `text` — universal display projection. Includes `[image]`/`[file: …]`/`[voice]`/`[audio]` tags inline.
- `messageId?` — platform-side id (Discord snowflake, Telegram int). Set on inbound/outbound.
- `payload?` — raw platform-native message object. Set on inbound only. Shape varies per `station`.

```json
{"kind":"inbound","id":"msg_aB3xY7zP","ts":"2026-05-14T12:00:00Z","station":"telegram","line":"metro://telegram/-100…/247","lineName":"infra","from":"metro://telegram/user/12345","fromName":"@alice","to":"metro://claude/user/9bfc7af0-…","messageId":"4567","text":"hi [image]","payload":{"message_id":4567,"chat":{"id":-100,"type":"supergroup","is_forum":true},"from":{"id":12345,"username":"alice"},"text":"hi","photo":[{"file_id":"…"}],"reply_to_message":{"message_id":4500,"text":"earlier","from":{"id":99,"username":"bob"}}}}
```

```json
{"kind":"inbound","id":"msg_pQ4r5sT0","ts":"…","station":"claude","line":"metro://claude/9bfc7af0-…/50b00d11-…","from":"metro://codex/user/8119ecb1-…","to":"metro://claude/9bfc7af0-…/50b00d11-…","text":"deploy green"}
```

### `payload` by station

`payload` is the platform's native message shape. Narrow on `event.station`:

- **`discord`** — discord.js `Message.toJSON()`: camelCase fields (`channelId`, `guildId`, `content`, `author`, `mentions: { users[], roles[], everyone }`, `attachments[]`, `reference`, …). Collections come back as **arrays of IDs**. `referencedMessage` is added inline on replies (auto-fetched).
- **`telegram`** — raw Bot API `Message` (snake_case): `{ message_id, chat, from, text, caption, entities[], photo[], document, voice, audio, reply_to_message, … }`. `reply_to_message` is inline on replies.
- **`webhook`** — `{ headers, body }`. The provider lives in `headers['x-github-event']`, `headers['x-intercom-topic']`, etc. Full event payload is `body` (parsed JSON when possible). `text` is a short summary; always narrow on `body` for real routing.

Use `payload` for anything the envelope doesn't surface — mentions, reply chains, embeds, entities.

## Detecting "is this for me?"

Derive from `payload`. Bot id per station is cached in `$METRO_STATE_DIR/bot-ids.json` (`{discord:"<userId>", telegram:"<userId>"}`, written by the daemon on start).

- **discord** — DM when `payload.guildId == null`; otherwise pinged when `payload.mentions.users.includes(<bot-id>)`.
- **telegram** — DM when `payload.chat.type === 'private'`; otherwise pinged when any entity in `payload.entities` (or `caption_entities`) is `{type:"mention"}` matching `@<bot-username>` or `{type:"text_mention", user:{id:<bot-id>}}`.
- **webhook** — every POST is "for you" by design (it's an endpoint you registered). Route on `payload.headers['x-github-event']` / `x-intercom-topic` etc. to decide which provider event you're handling.

Default for chat: only reply on DM or ping; otherwise stay silent or `metro react` to ack. Webhooks have no "ack" mechanism — just consume the event.

Both `from` and `to` are **participant URIs** (the conversation context lives in `line`):
- `metro://<station>/user/<id>` — a person on a chat platform
- `metro://claude/user/<orgId>` — a Claude Code user (orgId = stable Anthropic-account UUID, same across devices for the same account)
- `metro://codex/user/<accountId>` — a Codex user (accountId = stable ChatGPT-account UUID, same across devices)
- `metro://webhook/<endpoint-id>` — a webhook endpoint (line + `from` are the same — no HTTP-side user identity)
- `metro://<station>/<channelId>` — a channel (used as `to` for fresh sends to a group, where no single recipient)

When **you** send via `metro <station> reply|send|…`, metro auto-stamps `from = metro://claude/user/<orgId>` (when `$CLAUDECODE` is set; resolved from `claude auth status --json`) or `metro://codex/user/<accountId>` (from `$METRO_CODEX_RC` / `$CODEX_HOME`; resolved from `$CODEX_HOME/auth.json`). Switching accounts via `claude auth login` / `codex login` flips the id on the next event (within ~5 s for the daemon). Override via `$METRO_FROM`. When replying/reacting, `to` is automatically the original sender (looked up via the universal id).

The `id` is the **canonical handle** for that message across all stations — store it if you want to refer back to it later.

- `kind: "inbound"` — a message arrived. Source can be a human on Discord/Telegram, a webhook POST, or another Claude / Codex user posting to your line via `metro send` (cross-process).

`text` may contain `[image]`, `[voice]`, `[audio]`, or `[file: <name>]` placeholders alongside the real text — non-image attachments are opaque markers; images can be materialized via `metro download`.

## Required flow on every event

1. **Echo `event.display` verbatim as your first chat output.** Every event ships a pre-rendered chat-bubble in `event.display` — bold header (icon + station + sender) and a markdown blockquote body. Render this string as-is, before any commentary or tool calls. Monitor's notification chip is a CLI-only UI and won't surface visibly in VSCode/Cursor, so this echo is the only cross-surface signal the user has. Example:

   ```
   **📩 telegram · @bonustrack**
   > Hey
   ```

   Don't compose your own bubble — the format is centralized in metro's dispatcher; just paste the string.

2. **Decide and act** using the subcommands below.

No server-side auto-reaction — don't expect 👀 to be on the user's message; add one yourself with `metro react` if you want to ack quickly.

## Subcommands

Every outbound action goes through the generic dispatch:

```
metro <station> <action> <args>      # args = JSON string | @path/to/file | -  (stdin)
```

`metro stations` lists the loaded stations and the actions each one exposes.
Append `--json` to any subcommand for parseable output.

### Discord + Telegram action menu

Both stations expose the same surface: `reply`, `send`, `react`, `edit`,
`download`, `fetch`, `getMe`.

```bash
metro discord reply '{"line":"metro://discord/123","messageId":"456","text":"ack"}'
metro telegram send '{"line":"metro://telegram/-100…","text":"build green"}'
metro discord react '{"line":"metro://discord/123","messageId":"456","emoji":"👀"}'
metro telegram edit '{"line":"metro://telegram/-100…","messageId":"42","text":"still working…"}'
metro discord download '{"line":"metro://discord/123","messageId":"456","outDir":"/tmp/dl"}'
metro discord fetch '{"line":"metro://discord/123","limit":10}'
```

Stdin args also work for long bodies:

```bash
metro discord reply @/tmp/args.json
echo '{"line":"…","messageId":"…","text":"long body"}' | metro discord reply -
```

### Rich content (send/reply)

Both stations accept the same args object:

```json
{ "line": "…",
  "text": "caption",
  "replyTo": "456",            (send only — reply takes messageId at top level)
  "images":    ["/tmp/a.png","/tmp/b.png"],
  "documents": ["/tmp/run.log"],
  "voice":     "/tmp/note.ogg",
  "buttons":   [[{"text":"Open PR","url":"https://github.com/x/y/pull/1"}]] }
```

Limits / quirks:
- 20 MB per file (both platforms).
- Telegram albums are single-type (all photos OR all documents).
- Telegram drops `buttons` when multiple attachments are sent.

### Cross-user notify

```bash
metro claude notify '{"line":"metro://claude/9bfc7af0-…/50b00d11-…","text":"build green"}'
metro codex  notify '{"line":"metro://codex/8119ecb1-…/01997d4b-…","text":"build green"}'
```

The daemon re-emits these on its stdout (and pushes via codex-rc if
configured). Requires `metro` to be running — the action throws otherwise.

### Webhook + tunnel

```bash
metro webhook add <label> [--secret=<hmac-secret>]
metro webhook list | remove <id>
metro tunnel setup <name> <hostname>
```

Limits / quirks:
- 20 MB per file (both platforms).
- Telegram albums are single-type (all photos OR all documents in one album). Mixing kinds in one send still works — metro splits into two album messages and returns the first id.
- Telegram drops `--buttons` when multiple attachments are sent (the Bot API doesn't allow `reply_markup` on media groups).
- URL buttons only (no callback / interactive components yet).

## When to use `reply` vs `send`

- **`reply`** — responding to a specific inbound message. Threads under it. Default for handling an `inbound` event.
- **`send`** — initiating without a triggering message: a long task finished, a follow-up the user asked you to deliver later, or posting to a Claude / Codex line (use `claude notify` / `codex notify`) to nudge a peer.

## Line URI scheme

`metro://<station>/<path>` — see [docs/uri-scheme.md](https://github.com/bonustrack/metro/blob/main/docs/uri-scheme.md) for the full grammar.

| Station    | Pattern                                   | Example                              |
|------------|-------------------------------------------|--------------------------------------|
| `discord`  | `metro://discord/<channel-id>`            | `metro://discord/1234567890`         |
| `telegram` | `metro://telegram/<chat-id>[/<topic-id>]` | `metro://telegram/-1001234567890/42` |
| `claude`   | `metro://claude/<user-id>/<session-id>`   | `metro://claude/9bfc7af0-…/50b00d11-…` |
| `codex`    | `metro://codex/<user-id>/<session-id>`    | `metro://codex/8119ecb1-…/01997d4b-…`  |
| `webhook`  | `metro://webhook/<endpoint-id>`           | `metro://webhook/fwaCgTKJuLAjS2K0`     |

The `messageId` is **not** part of the URI — it's a separate positional arg for `reply` / `edit` / `react` / `download`.

## Image attachments

When an event's `text` contains `[image]`:

1. `metro <station> download '{"line":"…","messageId":"…","outDir":"/tmp/dl"}'` — writes images to disk and prints absolute paths.
2. `Read` each path with your Read tool — the image enters your context as a vision input.
3. Reply normally with `metro <station> reply '{…}'`.

## Opaque attachment markers

`[voice]`, `[audio]`, and `[file: <name>]` are opaque — `metro download` only handles images. Acknowledge in text or ask the user to resend as a regular file.

## Cross-user notification

Both Claude Code and Codex can post to each other's line via the `notify` action:

```bash
metro claude notify '{"line":"metro://claude/9bfc7af0-…/50b00d11-…","text":"build green"}'
metro codex  notify '{"line":"metro://codex/8119ecb1-…/01997d4b-…","text":"build green"}'
```

The daemon re-emits the post on its stdout (and pushes via codex-rc if configured), so the peer sees an `{"kind":"inbound",...}` event. Requires the metro daemon to be running — these actions throw otherwise.

## Discoverability

- `metro lines` — list recently-seen conversations (sorted by recency).
- `metro stations` — list stations + capability matrix.
- `metro history` — universal message log (every inbound + outbound + edit + react across all stations). Newest first. Filters:
  - `--limit=N` (default 50)
  - `--line=<metro://…>` — only this conversation
  - `--station=<discord|telegram|claude|codex|webhook>`
  - `--kind=<inbound|outbound|edit|react>`
  - `--from=<sender>`
  - `--text=<substring>`
  - `--since=<iso>` — e.g. `--since=2026-05-14T00:00:00Z`
  - `--json` — machine-parseable

Daemon-side inbounds append on arrival. Outbound action results are NOT
auto-appended in this rewrite — track them yourself if you need them.
Stored at `$METRO_STATE_DIR/history.jsonl`.

## Universal message IDs

Per-station actions accept platform ids only (`"messageId":"4567"` Telegram,
or the Discord snowflake). Universal `msg_*` ids no longer resolve via the
CLI dispatch — look them up with `metro history` first.

Use universal IDs when chaining commands or referring back to a specific message across stations.

## Exit codes

- `0` success
- `1` usage error (bad args, unknown subcommand)
- `2` configuration error (no tokens — tell the user to run `metro setup`)
- `3` upstream error (rate limit, auth, network) — retry once after a few seconds before surfacing

`metro doctor` diagnoses tokens, gateways, dispatcher liveness, and codex-rc target.

## --json output

Append `--json` to any subcommand for parseable output. The catch-all
`metro <station> <action>` always prints the action's raw return value when
`--json` is set.

```bash
metro discord reply '{"line":"…","messageId":"…","text":"ack"}' --json
# {"messageId":"…"}
```

Use this when you need to capture the new `messageId` for a later edit.

## Don'ts

- ❌ Spawning a second metro daemon — there's one per machine (lockfile-enforced).
- ❌ Posting to a line that isn't in `metro lines` unless the user gave it to you explicitly.
- ❌ Narrating the tool ("I'll now use metro reply to…"). The tool call is already visible to the user.
