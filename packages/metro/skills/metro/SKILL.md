---
name: metro
description: Run the metro train-supervisor in this session — launch `metro` in the background, watch its stdout for inbound JSON events, and act on each. Use when the user asks to start/run/launch metro, when you see JSON lines on stdout shaped `{"station":"…","line":"metro://…","from":"…","to":"…","text":"…"}`, or when handling a chat/webhook reply/edit/react/send via `metro call`.
---

# Metro — event-interception wire

Metro is the wire between this session and any number of platforms. Platform code lives in
**trains** under `~/.metro/trains/` — single TS files that you (the agent) write, edit, or
replace on demand.

## What metro does

1. Spawns each file in `~/.metro/trains/*.{ts,js,mjs}` as a long-running Bun subprocess.
2. Multiplexes their stdout (JSON lines) into one unified event stream on metro's stdout.
3. Routes `metro call <train> <action> <args>` requests back to the matching train's stdin.
4. Two builtin event sources stay in core: **webhooks** (HTTP receiver) and **messenger** (in-daemon chat).

## Starting metro

**Claude Code:** `Bash(command: "metro", run_in_background: true)`, then attach `Monitor` to its stdout.

**Codex:** `shell(command: "METRO_CODEX_RC=ws://127.0.0.1:8421 metro", run_in_background: true)` — metro pushes each event via JSON-RPC `turn/start`. The user must run a Codex daemon + TUI on the same WebSocket URL (`codex app-server --listen ws://127.0.0.1:8421` + `codex --remote ws://127.0.0.1:8421`, type "hi" once to seed a thread).

`metro doctor` reports trains found, deps installed, dispatcher running, codex-rc, skill install.

## Envelope

Every event on stdout is a single JSON line:

```json
{"id":"msg_…","ts":"2026-05-17T18:00:00Z","station":"discord","line":"metro://discord/123","line_name":"infra","from":"metro://discord/user/456","from_name":"alice","to":"metro://claude/user/9bfc…","text":"hi","message_id":"789","reply_to":"…","payload":{…}}
```

Wire fields are `snake_case` on the train protocol; the dispatcher translates to camelCase for `history.jsonl`. Trains supply `line`, `from`, `to`, `text`, plus `payload` (the platform's native message). Metro mints `id` + `display` if missing.

**No `kind` field.** Direction is derived: `Line.isLocal(from)` → outbound (📤), else inbound (📩). Reactions and edits are train-specific — encode them in `text` (e.g. `[react 👀]`) plus whatever you need in `payload`.

## Outbound: `metro call <train> <action> <args>`

```
metro call discord send '{"line":"metro://discord/123","text":"hi","replyTo":"789"}'
metro call telegram react '{"line":"metro://telegram/-100/1","messageId":"42","emoji":"👀"}'
metro call discord edit  '{"line":"metro://discord/123","messageId":"999","text":"new"}'
```

`[args]` can be JSON, `@path/to/args.json`, `-` (stdin), or a bare string. Action names are whatever the train exposes — metro core knows nothing about them.

## Writing a new train

1. Start from `node_modules/@stage-labs/metro/examples/telegram.ts`.
2. Copy → `~/.metro/trains/<name>.ts` and edit. Keep the inbound envelope shape and the `op:"call"` → `op:"response"` protocol.
3. Deps (if needed): `cd ~/.metro && bun add <pkg>`. Credentials: `echo 'FOO_TOKEN=…' >> ~/.metro/.env`.
4. Restart the metro daemon (or just `metro trains restart <name>`) to pick up the new train.

Trains are throwaway — if the user asks for new functionality, rewrite the train rather than adding glue in core.

## First-run setup (once per machine)

```
mkdir -p ~/.metro && cd ~/.metro && bun init -y
cp node_modules/@stage-labs/metro/examples/telegram.ts ~/.metro/trains/
echo 'TELEGRAM_BOT_TOKEN=…' >> ~/.metro/.env
metro setup skill    # optional — installs this SKILL.md into ~/.claude / ~/.codex
metro
```

## Detecting "is this for me?"

Trains should set `is_private: true` for DMs. For groups, narrow on `payload`:

- **discord** — DM when `payload.guildId == null`; otherwise look at `payload.mentions.users`.
- **telegram** — DM when `payload.chat.type === 'private'`; otherwise look at `payload.entities` mentions.
- **webhook** — every POST is for you by design. Route on `payload.headers['x-github-event']` / `x-intercom-topic`.
- **messenger** — every event on the messenger line is between the user and the agent. No filtering needed.

## CLI cheat sheet

```
metro                                       # start the daemon
metro trains [list]                         # list trains + state
metro trains new <name>                     # scaffold ~/.metro/trains/<name>.ts
metro trains restart <name>                 # kill + respawn a train (resets backoff)
metro call <train> <action> <args>          # forward an action call
metro tail [--as=<user-uri>] [--follow]     # subscribe to the event log
metro history [--limit=N] [--line=…] [--from=…] [--text=…] [--since=…]
metro webhook add <label>                   # register an HTTP receive endpoint
metro tunnel setup <name> <hostname>        # configure a Cloudflare named tunnel
metro doctor                                # health check
```

## Webhooks (builtin source)

Webhooks stay in core because they're shared HTTP infra (one Cloudflare tunnel routes many endpoints). `metro webhook add <label>` issues an endpoint id; the full URL is `https://<tunnel-host>/wh/<id>` (or `http://127.0.0.1:8420/wh/<id>` locally). Events arrive on `metro://webhook/<id>`.

## Messenger (builtin source)

Direct chat between the agent and the device. Five endpoints — all under the same bearer-token guard as `/api/state`:

- `POST /api/messenger/send {text?, attachments?, as?}` — emit an envelope on `metro://messenger/owner`. Either text or attachments required.
- `POST /api/messenger/react {messageId, emoji, as?}` — emit a slim `payload.reactTo` envelope. If the sender already has an active reaction with this emoji on this target, emits `{removed: true}` instead — reactions are toggleable.
- `POST /api/messenger/upload` — raw binary upload (≤ 25 MiB, body = file bytes, `Content-Type` + optional `X-Filename` headers). Returns `{id, url, kind, mime, size, name?}`; files land in `$METRO_STATE_DIR/messenger-uploads/`.
- `GET /api/messenger/files/<name>` — stream a stored upload. Accepts `Authorization: Bearer …` header *or* `?token=…` query (for `<img>` / `<audio>` tags). Content-Type derived from extension.
- `POST /api/messenger/register {pushToken}` — store an Expo push token so agent replies push to the device.

The mobile + web companion apps use these for chat with the agent. The envelope is the standard slim shape — no `kind` / `emoji` fields, direction derived from `Line.isLocal(from)`.

## Crashes

If a train crashes, metro restarts it with backoff (1s → 5s → 30s, then gives up after 5 consecutive failures). Use `metro trains` to check state.
