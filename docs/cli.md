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

### `metro call <train> <action> [args]`

Forward an action call to a train via its stdin and print the response. Action
names are defined by the train; core knows the protocol
(`{op:"call", id, action, args}` → `{op:"response", id, result|error}`), not the
semantics.

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

## Outbound is always `metro call`

There is no `metro send` / `reply` / `edit` / `react` / `download`. All outbound
work is `metro call <train> <action> <args>`, where the action set is whatever the
train exposes. This keeps core agnostic to platform features — trains are rewritten
on demand without touching core. See [SKILL.md](../packages/metro/skills/metro/SKILL.md)
for the agent-facing quick reference and [examples](../packages/metro/examples/README.md)
for the wire protocol.
