---
name: metro
description: Run the metro Telegram/Discord/webhook relay in this session — launch `metro` in the background, watch its stdout for inbound JSON events, and act on each. Use when the user asks to start/run/launch metro, when you see JSON lines on stdout shaped `{"kind":"inbound","station":...,"line":"metro://...","messageId":...,"text":...}`, or when handling a chat/webhook reply/edit/react/send/download.
---

# Metro — Telegram / Discord / webhook relay

Launch `metro` once, then act on each inbound JSON line by calling `metro call <station> <METHOD> <path> [body]`.

## Starting metro

Claude Code: `Bash(command: "metro", run_in_background: true)`, then attach `Monitor` to stdout. Each line is one JSON event; stderr is pino logs.

Codex: `shell(command: "METRO_CODEX_RC=ws://127.0.0.1:8421 metro", run_in_background: true)`. Metro pushes events into your thread via JSON-RPC, so they arrive as user input on the next turn. Requires `codex app-server --listen ws://127.0.0.1:8421` + a live `codex --remote …` TUI.

If anything looks off, run `metro doctor`. Common: missing tokens (`metro setup telegram|discord <token>`), Discord Message Content Intent off, stale lockfile.

## Event shape

Each stdout line is one history entry (same record as `history.jsonl`):

- `kind` — `"inbound"` | `"outbound"` | `"edit"` | `"react"`. `react` carries `emoji` instead of `text`.
- `id` (`msg_…`), `ts` (ISO), `station` (`discord`/`telegram`/`webhook`/`claude`/`codex`).
- `line` — conversation URI; `lineName?` = channel/topic/webhook display name.
- `from` / `fromName?`, `to` — participant URIs (local user for DMs, line for groups).
- `text` — universal projection; includes `[image]`/`[file: …]`/`[voice]`/`[audio]` tags.
- `messageId?` — platform-side id. `payload?` — raw platform-native message.
- `display?` — pre-rendered chat-bubble markdown. **Echo verbatim as your first output on every event**, then act.

```json
{"kind":"inbound","id":"msg_…","ts":"2026-05-17T12:00:00Z","station":"telegram","line":"metro://telegram/-100…/247","lineName":"infra","from":"metro://telegram/user/12345","fromName":"@alice","to":"metro://claude/user/…","messageId":"4567","text":"hi [image]","payload":{ "...native Bot API Message..." }}
```

`payload` is the platform's native shape — narrow on `event.station`. Discord = discord.js `Message.toJSON()` (camelCase, `referencedMessage?` auto-fetched on replies). Telegram = Bot API `Message` (snake_case, `reply_to_message`, `entities`, …). Webhook = `{ endpointId, label, method, url, headers, body }`.

## Is this for me?

Bot id per station is cached in `$METRO_STATE_DIR/bot-ids.json` as `{discord, telegram}`. Default behaviour: only reply on DM or ping; otherwise stay silent or react to ack.

- **discord** — DM when `payload.guildId == null`; pinged when `payload.mentions.users` includes the bot id or `mentions.everyone === true`.
- **telegram** — DM when `payload.chat.type === 'private'`; pinged via `entities`/`caption_entities` (`{type:"mention"}` matching `@<bot-username>`, or `{type:"text_mention", user:{id:<bot-id>}}`).
- **webhook** — every POST is for you; route on `payload.headers['x-github-event']` / `x-intercom-topic`.

## `metro call` — outbound

```
metro call <station> <METHOD> <path> [body-json | @file | -]
```

`station` = `discord` | `telegram`. `path` = platform-native path. `body` = JSON literal, `@/path/to/body.json`, or `-` for stdin (multi-line via heredoc). The CLI injects base URL + auth — never write tokens or `https://…` yourself.

```bash
# Discord reply (threaded)
metro call discord POST /channels/<channelId>/messages '{
  "content":"ack","message_reference":{"message_id":"<messageId>"}
}'

# Telegram reply (threaded)
metro call telegram POST /sendMessage '{
  "chat_id":<chatId>,"text":"ack","reply_parameters":{"message_id":<messageId>}
}'

# Add a reaction — discord (URL-encode emoji)
metro call discord PUT '/channels/<channelId>/messages/<messageId>/reactions/%F0%9F%91%80/@me'
# Add a reaction — telegram
metro call telegram POST /setMessageReaction '{
  "chat_id":<chatId>,"message_id":<messageId>,"reaction":[{"type":"emoji","emoji":"👀"}]
}'
```

Edit your own message: `PATCH /channels/<id>/messages/<msgId>` (discord) or `POST /editMessageText` (telegram). For multi-line bodies, pipe stdin: `printf … | metro call telegram POST /sendMessage -`.

**File uploads** (`metro call` is JSON-only) — shell out to `curl` against the native API with `$DISCORD_BOT_TOKEN` / `$TELEGRAM_BOT_TOKEN` (both are exported by metro).

**Downloading attachments**: Discord — `payload.attachments[].url` is direct. Telegram — `metro call telegram POST /getFile '{"file_id":"…"}'` → use returned `file_path` against `https://api.telegram.org/file/bot$TELEGRAM_BOT_TOKEN/<file_path>`.

## Editing the adapter

`~/.metro/adapters/<station>/map.ts` exports `map(raw, metro) → envelope | null`. Daemon hot-reloads on save (mtime-based). Return `null` to drop a raw event — it's quarantined to `$METRO_STATE_DIR/unmatched/<station>/<id>.json`. Use `payload` for fields the envelope doesn't surface (mentions, reply chains, embeds, entities).

Templates ship with the package and auto-install on daemon startup; missing files are copied from `<package>/adapters/` into `~/.metro/adapters/`.

## URI scheme

`metro://<station>/<path>`. `messageId` is not part of the URI.

| Station    | Pattern                                   |
|------------|-------------------------------------------|
| `discord`  | `metro://discord/<channel-id>`            |
| `telegram` | `metro://telegram/<chat-id>[/<topic-id>]` |
| `claude`   | `metro://claude/<user-id>/<session-id>`   |
| `codex`    | `metro://codex/<user-id>/<session-id>`    |
| `webhook`  | `metro://webhook/<endpoint-id>`           |

## Don'ts

- Don't spawn a second daemon (lockfile-enforced).
- Don't narrate the tool — the tool call is already visible.
- Don't post to a line that isn't in `metro lines` unless the user gave it to you explicitly.
- Don't add CLI verbs to `map.ts` — keep it pure (project events only). Outbound goes through `metro call`.

## Exit codes

`0` ok · `1` usage · `2` config (no tokens — tell user to `metro setup`) · `3` upstream (retry once before surfacing).
