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
3. Routes outbound work back to the matching train's stdin — either a standardized
   messaging verb (`metro send`/`reply`/`react`/…, routed by the line's station) or
   the low-level `metro call <train> <action> <args>`.
4. Two builtin sources stay in core: **webhooks** (HTTP receiver) and `notify` (local IPC).

## Starting metro

**Claude Code:** `Bash(command: "metro", run_in_background: true)`, then attach `Monitor` to its stdout.

**Codex:** `shell(command: "METRO_CODEX_RC=ws://127.0.0.1:8421 metro", run_in_background: true)` — metro pushes each event via JSON-RPC `turn/start`. The user must run a Codex daemon + TUI on the same WebSocket URL (`codex app-server --listen ws://127.0.0.1:8421` + `codex --remote ws://127.0.0.1:8421`, type "hi" once to seed a thread).

`metro doctor` reports trains found, `~/.metro` deps, dispatcher running, codex-rc, tunnel, webhooks, env vars, and skill install.

If a dispatcher is already running, a bare `metro` does **not** start a rival daemon — it attaches as a live reader (`tail --follow --json --since=tail`), so a second agent shares the same daemon.

## Multi-agent discipline

When several agents share one machine, coordinate through a shared local handoff
file rather than sending from another agent's chat account. In the Metro project,
use `/tmp/metro-agents/HANDOFF.md` when it exists.

Reply or call back on the exact `line` from the inbound event unless the user
explicitly asks for a different destination. For account-scoped XMTP lines, send
only from the account owned by the current CLI/session — `metro call` enforces
this with a **send-guard** (see below).

**Claim a line for exclusive handling.** Two agents on one daemon can each tail a
claim-aware feed (the default). `metro claim <line>` takes ownership so other
tails stop seeing that line; `metro release <line>` returns it to broadcast;
`metro claims` prints the map. Tail modes: default `mine-or-unclaimed`
(your claims + anything unclaimed), `--strict` (only lines you claimed, needs
`--as`), `--unclaimed` (only unclaimed), `--all` (everything). Claims live in
`claims.json` under the state dir.

## Envelope

Every event on stdout is a single JSON line:

```json
{"id":"msg_…","ts":"2026-05-17T18:00:00Z","station":"discord","line":"metro://discord/123","line_name":"infra","from":"metro://discord/user/456","from_name":"alice","to":"metro://claude/user/9bfc…","text":"hi","message_id":"789","reply_to":"…","payload":{…}}
```

Wire fields are `snake_case` on the train protocol; the dispatcher translates to camelCase for `history.jsonl`. Trains supply `line`, `from`, `to`, `text`, plus `payload` (the platform's native message). Metro mints `id` + `display` if missing.

**No `kind` field.** Direction is derived: `Line.isLocal(from)` → outbound (📤), else inbound (📩). Inbound reactions/edits surface in `text` (e.g. `[react 👀]`) plus `payload`; outbound reactions/edits use the `react`/`unreact`/`edit` verbs.

## Outbound: standardized verbs (preferred)

Everyday outbound work uses the standardized messaging verbs. Each takes a
`<line>` first; the line encodes its station, so metro routes the verb to that
train automatically — **you never name the train**.

```
metro send   <line> <text> [--reply <msgId>] [--attach <path|url> ...]
metro reply  <line> <msgId> <text>
metro react  <line> <msgId> <emoji>
metro unreact <line> <msgId> <emoji>
metro edit   <line> <msgId> <text>
metro delete <line> <msgId>
metro read   <line> [--limit N] [--before <msgId>] [--since <ts>]
```

`<text>` is an inline string, `@file`, or `-` (stdin). Examples:

```
metro send  metro://discord/123 "hi" --reply 789
metro react metro://telegram/-100/1 42 👀
metro edit  metro://discord/123 999 "new"
```

The verbs share one **canonical envelope** —
`{line,text?,replyTo?,attachments?,emoji?,messageId?,limit?,before?,since?,account?}` —
and a fixed verb set (`send|reply|react|unreact|edit|delete|read`). Only
`xmtp`/`discord`/`telegram` speak this contract today; a verb on any other station
errors. A train-side adapter maps the envelope onto each station's native action
(e.g. `unreact`→`react` empty, `read`→`fetch`/`query`), so verbs work without
per-station custom payloads.

### Escape hatch: `metro call <train> <action> <args>`

For any station-specific action the verbs do not cover (e.g. `xmtp newGroup`):

```
metro call xmtp newGroup '{"members":["0x…"]}'
```

`[args]` can be JSON, `@path/to/args.json`, `-` (stdin), or a bare string. Action
names are whatever the train exposes — metro core knows nothing about them. Unlike
the verbs, `metro call` names the train explicitly.

**Send-guard (xmtp only):** when the caller's session (`claude` vs `codex`) is
known and the target XMTP account is owned by the *other* session, both the
messaging verbs and `metro call` refuse identity-targeting actions (`send`,
`reply`, `react`, `sendAttachment`, `newDm`, `newGroup`) — so a Codex CLI can't
accidentally send from the Claude
account. Ownership is read from `~/.metro/xmtp-accounts.json`; it allows when
ownership can't be attributed. Override with `METRO_ALLOW_CROSS_ACCOUNT=1`.

## Themed verbs (porcelain over `metro call`)

Noun-verb wrappers for the common XMTP conversation actions. They forward to the
same underlying xmtp train actions but add a uniform JSON envelope, `--quiet`, and
the full exit-code set. Additive - `metro call` and the messaging verbs are unchanged.

```
metro channel set-github <line> <url|->          # set/clear the channel's GitHub URL
metro channel set-labels <line> <a,b,c>          # set the channel's labels
metro channel meta <line> [--name N] [--description D] [--github U] [--labels a,b]
metro channel info <line>                         # print group info
metro group new <0xaddr…> [--name N] [--admin-only]   # create a group
metro group close <line>                          # archive a group (remove members)
metro group add | remove <line> <0xaddr…>         # add/remove members
metro dm <0xaddress> [--account <id>]             # open (or reuse) a DM, prints its line
metro board [tail flags]                          # alias of `metro tail`
```

**`--json` envelope.** With `--json`, themed verbs wrap output uniformly:
`{"ok":true,"command":"channel.meta","result":…}` on success, or
`{"ok":false,"command":…,"error":…,"code":…}` on failure. `--quiet` prints only
the result id (e.g. the new group/dm line). Legacy commands keep their original
`{ok,error,code}` shape.

**Exit codes:** `0` ok · `1` usage · `2` config · `3` upstream · `4` daemon not
running · `7` rate-limited.

## The verb registry & `metro schema`

Every station/core verb is declared once in a registry as
`{name, owner, kind:read|mutate, idempotent, inputSchema?, description, example}`.
That single declaration feeds `metro schema` introspection, the send-guard's
mutation set (a parity test asserts the guard ⊆ the registry's xmtp mutate set),
and CLI help. Introspect it:

```
metro schema [station] [--json]     # the "timetable": human table, or full registry as JSON
metro verbs  [station]              # alias of schema
```

`--json` emits `{"verbs":[{name,owner,kind,idempotent,description,example,hasInputSchema}]}`.

## Identity: accounts, sessions, `--from`

**Accounts** are the per-station credential entries in `~/.metro/<station>-accounts.json`
(xmtp/discord/telegram). Inspect and import them without hand-editing files:

```
metro account list [<station>]                   # id, station, eth address, key source, owner
metro account address [<id>]                     # an account's fundable eth address
metro account import xmtp <privkey> --id <name>  # import a raw-key xmtp account, written 0600
```

`account import` is xmtp-only, writes atomically at mode `0600`, refuses duplicate
ids/keys, and never restarts the daemon - run `metro trains restart xmtp` to load
it, then `metro account address <id>` for its address. Key/mnemonic files are kept
`0600` (dir `0700`) via secure-fs.

**Sessions** are an opt-in binding layer: `~/.metro/sessions.json` shaped
`{"<id>": {xmtp, discord, telegram, default}}` maps a named session to a per-station
account id. Each session gets owner URI `metro://session/<id>`. When the file is
absent (the default), identity falls back to the env / per-account owner - behavior
is byte-for-byte unchanged. Inspect:

```
metro whoami [--json]              # resolved owner URI, per-station accounts, the --strict tail cmd
metro session list [--json]        # read-only dump of sessions.json bindings
```

**`--from <session|account>`** routes an outbound message through a specific xmtp
account. It works on `send|reply|react|unreact|edit|delete|read`. A `--from` name
that matches a session id resolves via its binding; otherwise it is a literal
account id. Only xmtp is multi-account, so `--from` is inert on discord/telegram.
With no flag and no sessions.json, routing is unchanged.

```
metro send metro://xmtp/<account>/<conv> "hi" --from codex
```

**Webhook → session binding.** Bind a webhook endpoint to a session so its inbound
events are attributed to that session's owner:

```
metro webhook add <label> --session=<id> [--secret=…]
```

## Writing a new train

1. Start from `node_modules/@metro-labs/metro/examples/telegram.ts`.
2. Copy → `~/.metro/trains/<name>.ts` and edit. Keep the inbound envelope shape and the `op:"call"` → `op:"response"` protocol.
3. Deps (if needed): `cd ~/.metro && bun add <pkg>`. Credentials: `echo 'FOO_TOKEN=…' >> ~/.metro/.env`.
4. Restart the metro daemon (or just `metro trains restart <name>`) to pick up the new train.

Trains are throwaway — if the user asks for new functionality, rewrite the train rather than adding glue in core.

**Speaking the messaging verb-contract.** If you want `metro send`/`reply`/`react`/
`unreact`/`edit`/`delete`/`read` to route to your train (instead of forcing callers
to use `metro call`), accept the canonical envelope
(`{line,text?,replyTo?,attachments?,emoji?,messageId?,limit?,before?,since?}`) for
those action names. The first-party stations (xmtp/discord/telegram) live in the
repo at `packages/metro/src/stations/<name>/` and translate the envelope to their
native actions via `src/stations/messaging-normalize.ts` — copy that pattern.

## First-run setup (once per machine)

```
mkdir -p ~/.metro && cd ~/.metro && bun init -y
cp node_modules/@metro-labs/metro/examples/telegram.ts ~/.metro/trains/
echo 'TELEGRAM_BOT_TOKEN=…' >> ~/.metro/.env
metro setup skill    # optional — installs this SKILL.md into ~/.claude / ~/.codex
metro
```

## Detecting "is this for me?"

Trains should set `is_private: true` for DMs. For groups, narrow on `payload`:

- **discord** — DM when `payload.guildId == null`; otherwise look at `payload.mentions.users`.
- **telegram** — DM when `payload.chat.type === 'private'`; otherwise look at `payload.entities` mentions.
- **webhook** — every POST is for you by design. Route on `payload.headers['x-github-event']` / `x-intercom-topic`.

## CLI cheat sheet

```
metro                                       # start the daemon (or attach as a reader if one runs)
metro lines                                 # list recently-seen conversations
metro trains [list]                         # list trains + state (running, pid, fail count)
metro trains new <name>                     # scaffold ~/.metro/trains/<name>.ts from the example
metro trains restart <name>                 # kill + respawn a train (resets backoff)
metro send  <line> <text> [--reply <id>] [--attach <path|url> ...]   # send (text: inline | @file | -)
metro reply <line> <msgId> <text>           # reply (sugar for send --reply)
metro react   <line> <msgId> <emoji>        # add a reaction
metro unreact <line> <msgId> <emoji>        # remove a reaction
metro edit   <line> <msgId> <text>          # edit a sent message
metro delete <line> <msgId>                 # delete a message
metro read   <line> [--limit N] [--before <id>] [--since <ts>]       # read recent messages
metro call <train> <action> [args]          # escape hatch (args: JSON | @file | - | bare string)
metro tail [--as=<user-uri>] [--follow] [--strict|--unclaimed|--all] [--include-webhooks]
           [--chat=<line>] [--station=…] [--since=<offset|tail>] [--limit=N]
metro history [--limit=N] [--line=…] [--station=…] [--from=…] [--text=…] [--since=…]
metro claim <line> [--as=<user-uri>]        # take exclusive ownership of a line
metro release <line>                        # release a line back to broadcast
metro claims                                # print the current claims map
metro whoami [--json]                       # resolved identity: owner, accounts, strict tail cmd
metro session list [--json]                 # read-only sessions.json bindings
metro account list [<station>]              # list accounts (id, address, key source, owner)
metro account address [<id>]                # an account's fundable eth address
metro account import xmtp <privkey> --id <name>   # import a raw-key xmtp account (0600)
metro schema [station] [--json]             # the verb registry / "timetable" (alias: verbs)
metro channel set-github|set-labels|meta|info <line> [flags]   # themed channel verbs
metro group new|close|add|remove [args]     # themed group verbs
metro dm <0xaddress> [--account <id>]       # open/reuse a DM, prints its line
metro board [tail flags]                    # alias of `metro tail`
metro webhook add <label> [--secret=…] [--session=<id>]   # register an HTTP receive endpoint
metro webhook list | remove <id>            # list/remove endpoints
metro tunnel setup <name> <hostname>        # configure a Cloudflare named tunnel
metro tunnel status                         # show tunnel config
metro setup [skill [clear]]                 # config status; install/remove this SKILL.md
metro doctor                                # health check
metro update                                # upgrade in place
metro --version | --help

# Global: --json (machine-readable output, and {"ok":false,…} on errors).
#         --quiet (themed verbs: print only the result id).
# Exit codes: 0 ok · 1 usage · 2 config · 3 upstream · 4 daemon not running · 7 rate-limited.
```

## Webhooks (builtin source)

Webhooks stay in core because they're shared HTTP infra (one Cloudflare tunnel routes many endpoints). `metro webhook add <label>` issues an endpoint id; the full URL is `https://<tunnel-host>/wh/<id>` (or `http://127.0.0.1:8420/wh/<id>` locally). Events arrive on `metro://webhook/<id>`.

## Crashes

If a train crashes, metro restarts it with backoff (1s → 5s → 30s, then gives up after 5 consecutive failures). Use `metro trains` to check state.
