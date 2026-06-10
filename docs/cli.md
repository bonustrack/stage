# CLI Reference

The `metro` CLI is the single entry point to the daemon. With no arguments it
runs (or attaches to) the dispatcher; with a subcommand it performs a one-shot
operation. Source: [`packages/metro/src/cli/index.ts`](../packages/metro/src/cli/index.ts).

```sh
metro [--version | --help]
metro <command> [args] [flags]
```

## Global flags

| Flag       | Effect                                                                       |
|------------|------------------------------------------------------------------------------|
| `--json`   | Machine-readable output on any command. On error: `{"ok":false,"error":…,"code":…}`. |
| `--version`, `-v` | Print the package version and exit.                                    |
| `--help`, `-h`    | Print usage and exit.                                                  |

## Exit codes

| Code | Meaning              |
|------|----------------------|
| `0`  | success              |
| `1`  | usage error          |
| `2`  | config error         |
| `3`  | upstream/train error |
| `4`  | daemon not running (also: send-guard refusal) |
| `7`  | rate-limited (themed verbs detect 429 / "rate limit" upstream errors) |

## Running the dispatcher

```sh
metro
```

Starts the dispatcher, which spawns every train in `~/.metro/trains/`, multiplexes
their stdout into one JSON event stream, appends each event to `history.jsonl`, and
forwards `metro call` requests back to trains over stdin.

Single-instance behavior: a dispatcher holds a lockfile (`$METRO_STATE_DIR/.tail-lock`).
If one is already running, a bare `metro` does **not** start a competing daemon:

- A Claude Code session attaches as a live reader — equivalent to
  `metro tail --follow --json --since=tail`, so it gets its own claim-aware feed.
- A Codex session (`$METRO_CODEX_RC` set) attaches the standalone Codex bridge to
  the existing daemon instead of starting a second dispatcher.

## Commands

### `metro doctor`

Health check: trains found, deps installed, dispatcher running, codex-rc status,
tunnel/webhook config, required env vars, skill install. Run this first when
debugging.

### `metro setup [skill [clear]]`

- `metro setup` — print config status (credentials are owned by trains, not core).
- `metro setup skill` — install the metro skill into `~/.claude` / `~/.codex`.
- `metro setup skill clear` — remove it.

### `metro trains [list]`

List supervised trains with running state, pid, and consecutive-failure count.

- `metro trains new <name>` — scaffold `~/.metro/trains/<name>.ts` from the example.
- `metro trains restart <name>` — kill and respawn a train, resetting its backoff.

### Messaging verbs: `send` / `reply` / `react` / `unreact` / `edit` / `delete` / `read`

The standardized messaging verbs are the everyday way to act on a conversation.
Each takes a `<line>` first; the line encodes its station (`metro://<station>/…`),
so metro routes the verb to that train automatically — you never name the train.
Source: [`src/cli/messaging.ts`](../packages/metro/src/cli/messaging.ts).

```sh
metro send   <line> <text> [--reply <msgId>] [--attach <path|url> ...]
metro reply  <line> <msgId> <text>
metro react  <line> <msgId> <emoji>
metro unreact <line> <msgId> <emoji>
metro edit   <line> <msgId> <text>
metro delete <line> <msgId>
metro read   <line> [--limit N] [--before <msgId>] [--since <ts>]
```

- `<text>` is an inline string, `@file` (read from a file), or `-` (read stdin).
- `metro reply` is sugar for `send --reply`.
- `metro read` asks the train for live history; if the station does not implement
  `read`, it falls back to the daemon's `history.jsonl` log.
- Each verb builds a **canonical envelope** and forwards it as a normal `forward-call`.
  Only `xmtp`, `discord`, and `telegram` speak the messaging contract today; a verb
  on any other station errors (`station '<x>' does not speak the messaging contract`).

```sh
metro send  metro://discord/123 "ack" --reply 4567
metro send  metro://discord/123 "see attached" --attach ./out.png
metro react metro://telegram/-100/42 4567 👍
metro edit  metro://discord/123 9876 "fixed typo"
echo "piped body" | metro send metro://discord/123 -
```

#### The canonical envelope + verb-contract

The verbs share one envelope and a fixed verb set, so messages can be
sent/replied/reacted/queried uniformly across stations without per-platform
payloads ([`src/messaging.ts`](../packages/metro/src/messaging.ts)):

```ts
verbs: send | reply | react | unreact | edit | delete | read
envelope: { line, text?, replyTo?, attachments?, emoji?, messageId?,
            limit?, before?, since?, account? }
```

A train-side adapter ([`src/stations/messaging-normalize.ts`](../packages/metro/src/stations/messaging-normalize.ts))
translates the canonical envelope into each station's native `(action, args)`
before the train's own dispatch runs — e.g. `unreact` → `react` with an empty
emoji / `removed`, and `read` → the station's `fetch`/`query`. So the standardized
verbs work without rewriting each station's native handlers.

### Themed verbs: `channel` / `group` / `dm` (+ `board`)

First-class noun-verb commands that are thin, additive wrappers over the existing
xmtp train actions (routing unchanged — `metro call` and the messaging verbs keep
working exactly as before). Source:
[`src/cli/channels.ts`](../packages/metro/src/cli/channels.ts).

```sh
metro channel set-github <line> <url|->            # set/clear linked GitHub URL  → xmtp setGithub
metro channel set-labels <line> <a,b,c>           # set labels                    → xmtp setLabels
metro channel meta <line> [--name N] [--description D] [--github U] [--labels a,b]
                                                  # update name/description/appData → xmtp updateChannelMeta
metro channel info <line>                          # group info                    → xmtp groupInfo
metro group new <0xaddr…> [--name N] [--admin-only] # create a group              → xmtp newGroup
metro group close <line>                           # archive a group              → xmtp closeGroup
metro group add | remove <line> <0xaddr…>          # membership                   → xmtp addMembers/removeMembers
metro dm <0xaddress> [--account <id>]              # open (or reuse) a DM          → xmtp newDm
metro board [tail flags]                           # Metro-transit alias of `metro tail`
```

#### Uniform `--json` envelope + `--quiet`

The themed verbs share one machine-readable envelope (the legacy commands keep
their original output shape, so existing scripts are unaffected):

```jsonc
// success
{ "ok": true,  "command": "dm", "result": { "line": "metro://xmtp/…", "id": "…" } }
// failure
{ "ok": false, "command": "dm", "error": "…", "code": 4 }
```

- Human-readable output is the default; JSON is emitted only with `--json` (never
  auto-selected on a pipe).
- `--quiet` prints just the result id (e.g. the new line/thread/message id).
- Exit codes follow the table above; `7` is returned when the upstream error looks
  rate-limited (429 / "rate limit").

### `metro call <train> <action> [args]`

Low-level escape hatch when a station exposes an action the messaging verbs do
not cover (e.g. `xmtp newGroup`). Forward an action call to a train via its stdin
and print the response. Action names are defined by the train; core knows the
protocol (`{op:"call", id, action, args}` → `{op:"response", id, result|error}`),
not the semantics. Unlike the verbs, `metro call` names the train explicitly.

`[args]` accepts:

- inline JSON — `'{"line":"metro://discord/123","text":"hi"}'`
- `@path/to/args.json` — read JSON from a file
- `-` — read JSON from stdin
- a bare string — passed through as the argument

Examples:

```sh
metro call discord send  '{"line":"metro://discord/123","text":"ack","replyTo":"4567"}'
metro call telegram react '{"line":"metro://telegram/-100/42","messageId":"4567","emoji":"👍"}'
metro call discord edit  '{"line":"metro://discord/123","messageId":"9876","text":"fixed typo"}'
echo '{"line":"metro://discord/123","text":"piped"}' | metro call discord send -
```

#### XMTP send-guard

For the `xmtp` train, identity-bearing actions (`send`, `reply`, `react`,
`sendAttachment`, `newDm`, `newGroup`) pass through a per-session send-guard
([`src/cli/send-guard.ts`](../packages/metro/src/cli/send-guard.ts)). One shared
daemon serves multiple CLIs, and an XMTP send goes out under whatever account the
target `line` names — so a Codex session could otherwise accidentally send from the
Claude-owned account.

The guard refuses (exit code `4`) only when **all** of the following hold: the
caller's station is known (`claude` via `$CLAUDECODE`, or `codex` via
`$METRO_CODEX_RC`/`$CODEX_HOME`), the target account's owner is known (from
`~/.metro/xmtp-accounts.json`), and they conflict. If any side is ambiguous (e.g. a
human running `metro` directly), it allows. Override with
`METRO_ALLOW_CROSS_ACCOUNT=1`. Read-only XMTP actions are never guarded.

### `metro history [flags]`

Read the universal message log (newest first). Flags (all optional, AND-combined):

| Flag           | Effect                                       |
|----------------|----------------------------------------------|
| `--limit=N`    | cap results (default 50)                      |
| `--line=<uri>` | only entries on this line                     |
| `--station=<name>` | only entries from this station            |
| `--from=<uri>` | only entries from this participant            |
| `--text=<str>` | substring match on the body                   |
| `--since=<date>` | only entries after this timestamp           |

### `metro tail [flags]`

Subscribe to the event log; claim-aware by default. See
[broker semantics](../packages/metro/docs/broker.md) for the routing rules.

| Flag                  | Effect                                                              |
|-----------------------|--------------------------------------------------------------------|
| `--as=<user-uri>`     | tail as this identity (defaults to the resolved session self)      |
| `--follow`            | stay open and stream new entries via `fs.watch`                    |
| `--strict`            | deliver only events claimed by self (not unclaimed broadcast)      |
| `--unclaimed`         | deliver only events on lines nobody has claimed (router pattern)   |
| `--all`               | deliver everything regardless of claims (operator/observer)        |
| `--include-webhooks`  | include webhook traffic in a personal feed (excluded by default)   |
| `--chat=<line>`       | post-filter to one line                                            |
| `--station=<name>`    | post-filter to one station                                         |
| `--since=<offset\|tail>` | byte offset into the log, or `tail` for EOF (live-only)         |
| `--limit=N`           | cap emitted entries                                                |

`--strict`, `--unclaimed`, and `--all` are mutually exclusive. With no `--since`, a
reader resumes from its saved per-mode cursor. Note: the SSE `/api/tail` endpoint
shares the `--since` name but defaults to EOF, not the cursor.

### Claims

```sh
metro claim   <line> [--as=<user-uri>]   # take exclusive ownership of a line
metro release <line>                     # release; line returns to broadcast
metro claims                             # print the current claims map
```

Claims are a pure metadata edit on `claims.json` (last-writer-wins, lockfile-serialized).
They do not notify the daemon — tails read them at delivery time.

### `metro lines`

List recently-seen conversations (URI + display name + last-seen-ago), newest first.

### Webhooks

```sh
metro webhook add <label> [--secret=<shared-secret>]   # mint an HTTP receive endpoint
metro webhook list                                     # list endpoints
metro webhook remove <id>                              # remove one
```

Events arrive on `metro://webhook/<id>`. With a `--secret`, requests must carry a
matching `X-Hub-Signature-256` HMAC or are rejected with 401. See the
[URI scheme](../packages/metro/docs/uri-scheme.md#webhook-station) for the full
webhook envelope.

### Tunnel

```sh
metro tunnel setup <name> <hostname>   # configure a Cloudflare named tunnel
metro tunnel status                    # show current tunnel config
```

A named tunnel gives webhook endpoints a stable public URL
(`https://<hostname>/wh/<id>`). Without one, endpoints stay loopback-only.

### `metro update`

Upgrade the installed package in place.

## Two outbound paths

- **Standardized verbs** (`send` / `reply` / `react` / `unreact` / `edit` /
  `delete` / `read`) — routed by the line's station, sharing one canonical
  envelope. This is the everyday path.
- **`metro call <train> <action> <args>`** — the low-level escape hatch for any
  station-specific action the verbs do not cover. Action names are whatever the
  train exposes; core stays agnostic to platform features.

See [SKILL.md](../packages/metro/skills/metro/SKILL.md) for the agent-facing quick
reference and [examples](../packages/metro/examples/README.md) for the wire protocol.
