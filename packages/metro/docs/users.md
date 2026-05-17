# Metro: a guide for Claude Code / Codex users

You are running inside a session that has **launched `metro`** in the background. Metro emits a live stream of JSON events from Discord, Telegram, third-party webhooks (GitHub, Intercom, …), and other users on its stdout. Your job is to consume that stream and post replies back via `metro call`.

## Starting metro

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

Every event is a **history entry** — same record appended to `history.jsonl`. Fields: `kind` (`inbound`/`outbound`/`edit`/`react`), `id` (`msg_…`), `ts`, `station`, `line` (conversation), `lineName?`, `from` (participant URI), `fromName?`, `to`, `text`, `messageId?` (platform-side id), `payload?` (raw platform message; inbound only), `display?` (pre-rendered chat-bubble markdown).

```json
{"kind":"inbound","id":"msg_aB3xY7zP","ts":"2026-05-17T12:00:00Z","station":"telegram","line":"metro://telegram/-100…/247","lineName":"infra","from":"metro://telegram/user/12345","fromName":"@alice","to":"metro://claude/user/9bfc7af0-…","messageId":"4567","text":"hello [image]","payload":{"message_id":4567,"chat":{"id":-100,"type":"supergroup","is_forum":true},"from":{"id":12345,"username":"alice"},"text":"hello","entities":[{"type":"mention","offset":0,"length":6}],"photo":[{"file_id":"…"}],"reply_to_message":{"message_id":4500,"text":"earlier","from":{"id":99,"username":"bob"}}}}
```

### `payload` by station

`payload` is the platform's native message shape. Narrow on `event.station`:

- **`discord`** — discord.js `Message.toJSON()`: camelCase (`channelId`, `guildId`, `content`, `author`, `mentions`, `attachments[]`, `reference`, `channelName?`, `referencedMessage?` on replies).
- **`telegram`** — raw Bot API `Message` (snake_case): `{ message_id, chat, from, text, caption, entities[], photo[], document, voice, audio, reply_to_message, message_thread_id, is_topic_message, … }`. `reply_to_message` is inline on replies.
- **`webhook`** — `{ endpointId, label, method, url, headers, body }`. Provider lives in `headers['x-github-event']` / `x-intercom-topic`; full event is `body` (parsed JSON when possible).

Both `from` and `to` are **participant URIs** (the conversation lives in `line`): `metro://<station>/user/<id>` for a person, `metro://claude/user/<orgId>` for a Claude Code user, `metro://codex/user/<accountId>` for a Codex user.

`text` may include `[image]` / `[voice]` / `[audio]` / `[file: <name>]` placeholders alongside the real text — non-image attachments are opaque markers; images can be fetched from the platform directly (see below).

## Required flow on every event

1. **Echo `event.display` verbatim as your first chat output.** Every event ships a pre-rendered chat-bubble in `event.display` — bold header (icon + station + sender) and a markdown blockquote body. Paste it as-is before any commentary or tool calls:

   ```
   **📩 telegram · @bonustrack**
   > Hey
   ```

   Don't compose your own bubble — the format is centralized in metro's dispatcher (`formatDisplay()` in `src/history.ts`).

2. **Decide and act** using `metro call` below.

## Detecting "is this for me?"

Derive from `payload`. Bot id per station is in `$METRO_STATE_DIR/bot-ids.json` (`{discord:"<userId>", telegram:"<userId>"}`).

- **`discord`** — DM if `payload.guildId == null`; otherwise pinged if `payload.mentions.users` contains the bot id, or `payload.mentions.everyone === true`.
- **`telegram`** — DM if `payload.chat.type === 'private'`; otherwise pinged if any entity in `payload.entities` (or `caption_entities`) is `{type:"mention"}` matching `@<bot-username>` or `{type:"text_mention", user:{id:<bot-id>}}`.
- **`webhook`** — every POST is for you (you registered the endpoint). Route on `payload.headers['x-github-event']` / `x-intercom-topic` etc. to know which provider event it is.

Default for chat: only reply on DM or ping; otherwise stay silent or react to ack. Webhooks just consume — no ack mechanism.

## The `metro call` contract

```
metro call <station> <METHOD> <path> [body-json | @file | -]
```

`station` = `discord` | `telegram`. `path` is the platform-native path. `body` is JSON: a literal, `@/path/to/file.json`, or `-` for stdin (heredoc). The CLI applies the per-station base URL + auth automatically.

### Discord recipes

```bash
# Reply (threaded)
metro call discord POST /channels/<channelId>/messages '{
  "content":"ack",
  "message_reference":{"message_id":"<messageId>"}
}'

# Fresh send
metro call discord POST /channels/<channelId>/messages '{"content":"build green"}'

# Edit
metro call discord PATCH /channels/<channelId>/messages/<messageId> '{"content":"updated"}'

# React (emoji URL-encoded; 👀 = %F0%9F%91%80)
metro call discord PUT '/channels/<channelId>/messages/<messageId>/reactions/%F0%9F%91%80/@me'

# URL buttons
metro call discord POST /channels/<channelId>/messages '{
  "content":"approve?",
  "components":[{"type":1,"components":[
    {"type":2,"style":5,"label":"Open PR","url":"https://github.com/x/y/pull/1"}]}]
}'
```

### Telegram recipes

```bash
# Send
metro call telegram POST /sendMessage '{"chat_id":-100…,"text":"build green"}'

# Reply
metro call telegram POST /sendMessage '{
  "chat_id":-100…,"text":"ack",
  "reply_parameters":{"message_id":4567}
}'

# Edit
metro call telegram POST /editMessageText '{
  "chat_id":-100…,"message_id":4567,"text":"updated"
}'

# React
metro call telegram POST /setMessageReaction '{
  "chat_id":-100…,"message_id":4567,
  "reaction":[{"type":"emoji","emoji":"👀"}]
}'

# Forum topic (include message_thread_id from the line)
metro call telegram POST /sendMessage '{
  "chat_id":-100…,"message_thread_id":247,"text":"in-topic"
}'
```

### File uploads

`metro call` is JSON-only. For images / documents / voice, build a multipart `curl` directly:

```bash
# Telegram
curl -fsS https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendPhoto \
  -F chat_id=-100… -F photo=@/tmp/build.png -F caption='build green'

# Discord
curl -fsS -X POST https://discord.com/api/v10/channels/<channelId>/messages \
  -H "Authorization: Bot $DISCORD_BOT_TOKEN" \
  -F payload_json='{"content":"screenshot"}' \
  -F files[0]=@/tmp/build.png
```

### Downloading inbound images

- **Discord** — `payload.attachments[0].url` is a direct CDN link; `curl -fsSL -o /tmp/img.png "$URL"`.
- **Telegram** — two-step:

  ```bash
  metro call telegram POST /getFile '{"file_id":"<file_id>"}'
  # → { "file_path":"photos/file_42.jpg", ... }
  curl -fsSL -o /tmp/img.jpg \
    "https://api.telegram.org/file/bot$TELEGRAM_BOT_TOKEN/photos/file_42.jpg"
  ```

Then `Read` the file to bring it into context.

## Cross-user notification

Both Claude Code and Codex can post to each other's **line** — `metro://claude/<user-id>/<session-id>` or `metro://codex/<user-id>/<session-id>`. `<user-id>` is the peer's stable account id (cross-device); `<session-id>` is one conversation. Discover both via `metro stations` or `$METRO_STATE_DIR/user-registry.json`.

This goes through the daemon's IPC socket, not `metro call`. Send a JSON request to `$METRO_STATE_DIR/metro.sock` of the form `{"op":"notify","line":"metro://claude/…","text":"…"}` — or wait for a future `metro notify` shorthand. The daemon re-emits the post on its stdout stream (and pushes via codex-rc if configured), so the peer sees it as an inbound event.

## Editing the adapter

Each station projection lives at `~/.metro/adapters/<station>/map.ts`:

```js
export function map(raw, _metro) {
  if (raw.kind === 'message') return mapMessage(raw.payload);
  if (raw.kind === 'reaction') return mapReaction(raw.payload);
  return null;          // ← null drops the event (quarantined under $STATE_DIR/unmatched)
}
```

The daemon hot-reloads on save. Edit freely to surface new fields, drop noise, or route platform variants — most cases need no code outside the adapter.

## `metro history`

Every inbound, outbound, edit, react is in `$METRO_STATE_DIR/history.jsonl`.

```bash
metro history --limit=20                              # recent 20
metro history --line=metro://discord/123              # only this conversation
metro history --kind=inbound --since=2026-05-14
metro history --station=telegram --text=deploy
metro history --from='@alice' --json
```

Filters: `--limit` (default 50), `--line`, `--station`, `--kind`, `--from`, `--text`, `--since` (ISO), `--json`.

## Discovery

- `metro lines` — recent conversations sorted by recency.
- `metro stations` — configured stations + seen users.

## Webhooks (receiving HTTP events)

1. **One-time tunnel setup**: `metro tunnel setup <tunnel-name> <hostname>`. Requires `cloudflared` (`brew install cloudflared`) + a Cloudflare-hosted domain.
2. **Register an endpoint**: `metro webhook add <label> [--secret=<shared-secret>]`. Prints the public URL — paste it into the provider's webhook settings. For GitHub: **Content type: `application/json`**.
3. **Run `metro`**. The daemon binds 127.0.0.1:8420 (override `METRO_WEBHOOK_PORT`) and spawns `cloudflared tunnel run` if `tunnel.json` exists.

Each POST becomes an inbound event. `text` is a short summary; the real payload is `payload.body`. With `--secret`, metro verifies `X-Hub-Signature-256` and rejects mismatches with 401.

## Don'ts

- Don't spawn a second metro daemon — there's one per machine (lockfile-enforced).
- Don't `metro call` to a line that isn't in `metro lines` unless the user gave it to you explicitly.
- Don't narrate the tool ("I'll now use metro call to…"). The tool call is already visible.
- Don't edit `~/.metro/adapters/<station>/map.ts` to add CLI verbs — keep `map()` pure (project events only). Outbound goes through `metro call`.

## Further reading

- URI scheme: [`uri-scheme.md`](uri-scheme.md)
- Skill (the canonical reference, kept in sync with this file): `skills/metro/SKILL.md` inside the package
- Source: https://github.com/bonustrack/metro
