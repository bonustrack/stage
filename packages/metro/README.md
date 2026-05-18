# Metro

[![npm](https://img.shields.io/npm/v/@stage-labs/metro/beta?label=npm&color=cb3837)](https://www.npmjs.com/package/@stage-labs/metro)
[![lines of code](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fapi.codetabs.com%2Fv1%2Floc%2F%3Fgithub%3Dbonustrack%2Fmetro%26ignored%3Dapps%2Ctest&query=%24%5B0%5D.linesOfCode&label=lines%20of%20TypeScript&color=blue)](https://github.com/bonustrack/metro)

> **Event-interception wire. Supervises train subprocesses, multiplexes their stdout into one
> JSON event stream, routes outbound action calls back via stdin. Per-platform code lives in
> train scripts under `~/.metro/trains/` — outside this repo — written by the user (or agent)
> on demand.**

Metro is not a framework with platform connectors. Metro is the wire.

```
[Claude Code session]

$ metro &                              # backgrounded
$ Monitor( … metro's stdout … )

>>> {"kind":"inbound","station":"discord","line":"metro://discord/123…","message_id":"9876",
     "text":"@metro 5xx spike on /v1/sync — look?",
     "payload":{"channelId":"123…","guildId":"456…","content":"<@…> 5xx spike…",
                "mentions":{"users":["<bot-id>"],"roles":[],"everyone":false},…}}

  [I'd grep services/sync.ts, then…]
  Bash: metro call discord send '{"line":"metro://discord/123…","text":"three deploys in the last 24h…","replyTo":"9876"}'
```

You own streaming, tool calls, and reply timing. Metro is the wire.

---

## Quickstart

```bash
npm install -g @stage-labs/metro@beta    # or: bun add -g @stage-labs/metro@beta

# One-time train setup (Telegram — no npm deps needed; uses native fetch)
mkdir -p ~/.metro && cd ~/.metro && bun init -y
cp $(npm root -g)/@stage-labs/metro/examples/telegram.ts ~/.metro/trains/
echo 'TELEGRAM_BOT_TOKEN=your-token' >> ~/.metro/.env

metro doctor                                # verify
metro                                       # run the daemon
```

For Discord, copy the same `telegram.ts` and port it — swap the API base for
`https://discord.com/api/v10` with `Authorization: Bot $TOKEN`, install
`discord.js` for the gateway (`cd ~/.metro && bun add discord.js`), and keep
the same envelope + `op:"call"` ↔ `op:"response"` protocol. See
[`examples/README.md`](./examples/README.md) for the wire-format reference.

Requires **Bun ≥ 1.3** (trains run under `bun run`). Metro core itself works under Node ≥ 22.

---

## Architecture

```
~/.metro/trains/discord.ts ──> stdout JSON ──┐
~/.metro/trains/telegram.ts ─> stdout JSON ──┤
~/.metro/trains/<anything>.ts ─> stdout ─────┼──>  metro daemon ──>  stdout (Monitor / Codex push)
                                             │                       history.jsonl
HTTP /wh/<id>  (builtin webhook receiver) ───┤
IPC `notify`   (builtin cross-user channel) ─┘

metro call discord send {…}  ──>  IPC ──>  daemon  ──>  train stdin  ──>  response  ──> CLI stdout
```

Every event metro emits is a `HistoryEntry`. Trains produce the full envelope; metro
enriches `id`/`display` and appends to `history.jsonl`. Outbound action calls are
train-defined — metro core knows the protocol (`{op:"call", id, action, args}` → `{op:"response", id, result|error}`),
not what any specific action does.

---

## Train protocol

**Inbound (train → metro stdout)** — one JSON line per event (wire fields are `snake_case`):

```json
{"kind":"inbound","station":"discord","line":"metro://discord/123","from":"metro://discord/user/456","from_name":"alice","message_id":"789","text":"hi","is_private":false,"ts":"2026-05-17T18:00:00Z","payload":{...}}
```

**Outbound (metro → train stdin)** — one JSON line per action call:

```json
{"op":"call","id":"req_abc","action":"send","args":{"line":"metro://discord/123","text":"hi"}}
```

Train responds on stdout:

```json
{"op":"response","id":"req_abc","result":{"messageId":"999"}}
```

See [`examples/telegram.ts`](./examples/telegram.ts) (a self-contained ~110 LOC reference train) and [`examples/README.md`](./examples/README.md) for the full protocol + Discord port notes.

---

## CLI

```
metro                                    # start the daemon (foreground)
metro trains list                        # supervised trains + state
metro trains new <name>                  # scaffold ~/.metro/trains/<name>.ts from the example
metro trains restart <name>              # kill + respawn a train (resets backoff)
metro call <train> <action> <args>       # forward an action call; args = JSON / @file / - / string
metro tail [--as=<user-uri>] [--follow]  # subscribe to the event log; claim-aware
metro history [--limit=50] [--line=…]    # recent history (newest first), filterable
metro lines                              # recently-seen conversations
metro claim <line>                       # take exclusive ownership of a line
metro release <line>                     # release
metro claims                             # print the claims map
metro webhook add <label> [--secret=…]   # add an HTTP receive endpoint
metro webhook list | remove <id>         # manage endpoints
metro tunnel setup <name> <hostname>     # configure a Cloudflare named tunnel
metro tunnel status                      # show current tunnel config
metro setup [skill [clear]]              # status; or install/remove the skill into ~/.claude / ~/.codex
metro doctor                             # health check (trains, deps, tunnel, webhooks, env vars)
metro update                             # upgrade in place
```

No more `metro send / reply / edit / react / download / fetch` — outbound is always
`metro call <train> <action> <args>`, with action names defined by the train.

---

## State

- `~/.metro/trains/` — your train scripts
- `~/.metro/.env` — your credentials (trains read these)
- `~/.metro/package.json` — `bun add` here for train deps
- `$METRO_STATE_DIR` (default `~/.cache/metro/`) — history, claims, cursors, monitor data

---

## License

MIT
