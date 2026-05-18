---
name: metro
description: Run the metro train-supervisor in this session — launch `metro` in the background, watch its stdout for inbound JSON events, and act on each. Use when the user asks to start/run/launch metro, when you see JSON lines on stdout shaped `{"kind":"inbound","station":...,"line":"metro://...","message_id":...,"text":...}`, or when handling a chat/webhook reply/edit/react/send via `metro call`.
---

# Metro — event-interception wire

Metro is the wire between this session and any number of platforms. Platform code lives in
**trains** under `~/.metro/trains/` — single TS files that you (the agent) write, edit, or
replace on demand.

## What metro does

1. Spawns each file in `~/.metro/trains/*.{ts,js,mjs}` as a long-running Bun subprocess.
2. Multiplexes their stdout (JSON lines) into one unified event stream on metro's stdout.
3. Routes `metro call <train> <action> <args>` requests back to the matching train's stdin and prints the response.
4. Two builtin event sources stay in core: **webhooks** (HTTP receiver) and cross-user **notify** IPC.

## Starting metro

**Claude Code:** `Bash(command: "metro", run_in_background: true)`, then attach `Monitor` to its stdout.

**Codex:** `shell(command: "METRO_CODEX_RC=ws://127.0.0.1:8421 metro", run_in_background: true)` — metro pushes each event via JSON-RPC `turn/start`. The user must run a Codex daemon + TUI on the same WebSocket URL (`codex app-server --listen ws://127.0.0.1:8421` + `codex --remote ws://127.0.0.1:8421`, type "hi" once to seed a thread).

`metro doctor` reports trains found, deps installed, dispatcher running, codex-rc, skill install.

## Train protocol

**Inbound (train → metro stdout)** — one JSON line per event:

```json
{"kind":"inbound","station":"discord","line":"metro://discord/123","from":"metro://discord/user/456","from_name":"alice","message_id":"789","text":"hi","is_private":false,"ts":"2026-05-17T18:00:00Z","payload":{...}}
```

Wire fields are `snake_case` on the train protocol: `from_name`, `message_id`, `line_name`, `is_private`, `reply_to`. The dispatcher translates these to camelCase for `history.jsonl` and the broker. Trains supply `line`, `from`, `from_name`, `text`, `is_private`. Metro mints `id` + `display` if missing and appends to `history.jsonl`. `payload` is the platform's native message shape — use it for mentions, replies, embeds.

**Canonical `kind` enum**: `inbound | outbound | edit | react`. The dispatcher normalizes legacy aliases (`message` → `inbound`, `reaction` → `react`), but new trains should emit the canonical values directly. Anything else is passed through unchanged.

**Outbound (`metro call <train> <action> <args>`)**:

```
metro call discord send '{"line":"metro://discord/123","text":"hi","replyTo":"789"}'
metro call telegram react '{"line":"metro://telegram/-100/1","messageId":"42","emoji":"👀"}'
metro call discord edit  '{"line":"metro://discord/123","messageId":"999","text":"new"}'
```

`[args]` can be JSON, `@path/to/args.json`, `-` (stdin), or a bare string. Action names are whatever the train exposes — metro core knows nothing about them. The shipped example train (`telegram.ts`) exposes `send` and `react`; trains you write can expose anything.

## Writing a new train

1. Start from `node_modules/@stage-labs/metro/examples/telegram.ts` (the only shipped example — pattern is platform-independent).
2. Copy → `~/.metro/trains/<name>.ts` and edit. Keep the inbound shape and the `op:"call"` → `op:"response"` protocol.
3. Deps (if needed): `cd ~/.metro && bun add <pkg>`. Credentials: `echo 'FOO_TOKEN=…' >> ~/.metro/.env`.
4. Restart the metro daemon to pick up the new train.

Trains are throwaway — if the user asks for new functionality, rewrite the train rather than adding glue in core.

## First-run setup (once per machine)

Telegram (no npm deps — uses native fetch + long polling):

```
mkdir -p ~/.metro && cd ~/.metro && bun init -y
cp node_modules/@stage-labs/metro/examples/telegram.ts ~/.metro/trains/
echo 'TELEGRAM_BOT_TOKEN=…' >> ~/.metro/.env
metro setup skill    # optional — installs this SKILL.md into ~/.claude / ~/.codex
metro
```

Discord port: copy `telegram.ts` to `~/.metro/trains/discord.ts`, swap the API
base for `https://discord.com/api/v10` with `Authorization: Bot $TOKEN`,
`bun add discord.js` for the gateway, and keep the envelope + call/response
protocol unchanged.

## Detecting "is this for me?"

Trains should set `is_private: true` for DMs. For groups, narrow on `payload`:

- **discord** — DM when `payload.guildId == null`; otherwise look at `payload.mentions.users`.
- **telegram** — DM when `payload.chat.type === 'private'`; otherwise look at `payload.entities` mentions.
- **webhook** — every POST is for you by design. Route on `payload.headers['x-github-event']` / `x-intercom-topic`.

## CLI cheat sheet

```
metro                                    # start the daemon
metro trains list                        # list trains + state
metro trains new <name>                  # scaffold ~/.metro/trains/<name>.ts from the example
metro trains restart <name>              # kill + respawn a train (resets backoff)
metro call <train> <action> <args>       # forward an action call
metro tail --as=<user-uri> [--follow]    # subscribe to the event log
metro history --limit=50                 # recent history (newest first)
metro webhook add <label>                # register an HTTP receive endpoint
metro tunnel setup <name> <hostname>     # configure a Cloudflare named tunnel
metro doctor                             # health check (trains, deps, tunnel, webhooks, env vars)
```

## Webhooks (builtin source)

Webhooks stay in core because they're shared HTTP infra (one Cloudflare tunnel routes many endpoints). `metro webhook add <label>` issues an endpoint id; the full URL is `https://<tunnel-host>/wh/<id>` (or `http://127.0.0.1:8420/wh/<id>` locally). Events arrive with `kind:"inbound", station:"webhook"`.

## Crashes

If a train crashes, metro restarts it with backoff (1s → 5s → 30s, then gives up after 5 consecutive failures). Use `metro trains list` to check state.
